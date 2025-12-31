// Thin agent-level adapter for DatabaseTool
// Bridges LLM tool_call argument shape ({ ...params, context }) to the
// existing positional DatabaseTool API.

const DatabaseToolModule = require('./DatabaseTool');
let TraceService;
try {
  TraceService = require("../src/services/trace/TraceService");
} catch (e) {
  // Mock TraceService for probes when not available
  TraceService = {
    logEvent: async (event) => {
      console.log("[TraceService Mock]", event.type, event.summary || "");
    },
  };
}

// Resolve a usable DatabaseTool **instance** (not the class constructor).
// In production, backend/tools/DatabaseTool exports a default instance with
// get_subtask_full_context, list_subtasks_for_task, etc. In tests, Jest may
// mock this module with a plain object. We prefer whatever exposes the
// instance-style API (get_subtask_full_context as a method).
const DatabaseToolInstance =
  DatabaseToolModule &&
  typeof DatabaseToolModule.get_subtask_full_context === "function"
    ? DatabaseToolModule
    : DatabaseToolModule && DatabaseToolModule.DatabaseTool
    ? new DatabaseToolModule.DatabaseTool("Orion")
    : null;

const originalCreateSubtask =
  DatabaseToolInstance &&
  typeof DatabaseToolInstance.create_subtask === "function"
    ? DatabaseToolInstance.create_subtask.bind(DatabaseToolInstance)
    : null;

const originalGetSubtaskFullContext =
  DatabaseToolInstance &&
  typeof DatabaseToolInstance.get_subtask_full_context === "function"
    ? DatabaseToolInstance.get_subtask_full_context.bind(DatabaseToolInstance)
    : null;

const originalDeleteSubtask =
  DatabaseToolInstance &&
  typeof DatabaseToolInstance.delete_subtask === "function"
    ? DatabaseToolInstance.delete_subtask.bind(DatabaseToolInstance)
    : null;

const originalDeleteTask =
  DatabaseToolInstance && typeof DatabaseToolInstance.delete_task === "function"
    ? DatabaseToolInstance.delete_task.bind(DatabaseToolInstance)
    : null;

const originalDeleteFeature =
  DatabaseToolInstance &&
  typeof DatabaseToolInstance.delete_feature === "function"
    ? DatabaseToolInstance.delete_feature.bind(DatabaseToolInstance)
    : null;

const originalGetFeatureOverview =
  DatabaseToolInstance &&
  typeof DatabaseToolInstance.get_feature_overview === "function"
    ? DatabaseToolInstance.get_feature_overview.bind(DatabaseToolInstance)
    : null;

const originalCreateTask =
  DatabaseToolInstance && typeof DatabaseToolInstance.create_task === "function"
    ? DatabaseToolInstance.create_task.bind(DatabaseToolInstance)
    : null;

const DatabaseToolAgentAdapter = {
  // === get_feature_overview ===
  async get_feature_overview(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { feature_id: featureId, project_id: projectId, context } = args;
    if (!featureId) throw new Error("feature_id is required");

    const targetFn =
      originalGetFeatureOverview ||
      (DatabaseToolInstance && DatabaseToolInstance.get_feature_overview);
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(featureId, projectId);
  },

  // === create_task ===
  async create_task(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    // Align with functionDefinitions.js params
    const {
      feature_id: featureId,
      external_id: externalId,
      title,
      status,
      basic_info,
      pcc,
      cap,
      reason,
      context,
    } = args;

    if (!featureId) throw new Error("feature_id is required");
    if (!title) throw new Error("title is required");

    const targetFn =
      originalCreateTask ||
      (DatabaseToolInstance && DatabaseToolInstance.create_task);
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(
      featureId,
      externalId || null,
      title,
      status || "pending",
      basic_info || {},
      pcc || {},
      cap || {},
      reason || ""
    );
  },

  // === delete_subtask ===
  async delete_subtask(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { subtask_id: subtaskId, reason, context } = args;
    if (!subtaskId) throw new Error("subtask_id is required");

    const targetFn =
      originalDeleteSubtask ||
      (DatabaseToolInstance && DatabaseToolInstance.delete_subtask);
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(subtaskId, reason || "");
  },

  async get_subtask_full_context(args) {
    // Basic shape validation so bad tool_calls fail fast and clearly.
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw new Error(
        "DatabaseTool_get_subtask_full_context: args must be an object"
      );
    }

    const {
      subtask_id: subtaskId,
      project_id: explicitProjectId,
      context,
    } = args;

    if (
      subtaskId === undefined ||
      subtaskId === null ||
      (typeof subtaskId === "string" && subtaskId.trim() === "")
    ) {
      throw new Error(
        "DatabaseTool_get_subtask_full_context: subtask_id is required"
      );
    }

    let projectId;
    if (
      typeof explicitProjectId === "string" &&
      explicitProjectId.trim() !== ""
    ) {
      projectId = explicitProjectId.trim();
    } else if (
      context &&
      typeof context.projectId === "string" &&
      context.projectId.trim() !== ""
    ) {
      projectId = context.projectId.trim();
    }

    // ToolRunner now emits centralized tool_call/tool_result trace events.
    // Only emit adapter-level events when NOT invoked by ToolRunner.
    const shouldTrace = !context?.__trace_from_toolrunner;

    // Log tool_call event
    if (shouldTrace) {
      try {
        await TraceService.logEvent({
          projectId,
          type: "tool_call",
          source: "tool",
          timestamp: new Date().toISOString(),
          summary: "DatabaseTool_get_subtask_full_context call",
          details: { subtaskId, projectId },
          requestId: context?.requestId,
        });
      } catch (err) {
        console.error(
          "Trace logging failed for get_subtask_full_context call:",
          err
        );
      }
    }

    // Call original method (falls back to direct call if bound version is not available,
    // e.g. when DatabaseTool is a Jest mock object in tests).
    const targetFn =
      originalGetSubtaskFullContext ||
      (DatabaseToolInstance && DatabaseToolInstance.get_subtask_full_context);
    if (typeof targetFn !== "function") {
      throw new Error(
        "DatabaseTool_get_subtask_full_context: underlying implementation is not available"
      );
    }

    let result;
    try {
      result = await targetFn(subtaskId, projectId);
    } catch (error) {
      if (shouldTrace) {
        // Log a tool_result-style error event so the gap is visible in the trace timeline
        try {
          await TraceService.logEvent({
            projectId,
            type: "tool_result",
            source: "tool",
            timestamp: new Date().toISOString(),
            summary: "DatabaseTool_get_subtask_full_context error",
            details: {
              ok: false,
              hasSubtask: false,
              error: error.message,
            },
            error: { message: error.message },
            requestId: context?.requestId,
          });
        } catch (traceErr) {
          console.error(
            "Trace logging failed for get_subtask_full_context error:",
            traceErr
          );
        }
      }

      // Preserve existing behavior for callers (ToolRunner/OrionAgent)
      throw error;
    }

    // Log tool_result event
    if (shouldTrace) {
      try {
        await TraceService.logEvent({
          projectId,
          type: "tool_result",
          source: "tool",
          timestamp: new Date().toISOString(),
          summary: "DatabaseTool_get_subtask_full_context result",
          details: {
            ok: !!(result && result.ok),
            hasSubtask: !!(result && result.subtask),
            result,
          },
          requestId: context?.requestId,
        });
      } catch (err) {
        console.error(
          "Trace logging failed for get_subtask_full_context result:",
          err
        );
      }
    }

    return result;
  },

  // === delete_task ===
  async delete_task(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { task_id: taskId, reason, context } = args;
    if (!taskId) throw new Error("task_id is required");

    const targetFn =
      originalDeleteTask ||
      (DatabaseToolInstance && DatabaseToolInstance.delete_task);
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(taskId, reason || "");
  },

  // === delete_feature ===
  async delete_feature(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { feature_id: featureId, reason, context } = args;
    if (!featureId) throw new Error("feature_id is required");

    const targetFn =
      originalDeleteFeature ||
      (DatabaseToolInstance && DatabaseToolInstance.delete_feature);
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(featureId, reason || "");
  },

  async create_subtask(args) {
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw new Error("DatabaseTool_create_subtask: args must be an object");
    }

    const {
      task_id: taskId,
      external_id: externalId = null,
      title,
      status = "pending",
      workflow_stage = "orion_planning",
      basic_info = {},
      instruction = {},
      pcc = {},
      tests = {},
      implementation = {},
      review = {},
      reason = "",
      context,
    } = args;

    if (!taskId || (typeof taskId === "string" && taskId.trim() === "")) {
      throw new Error("DatabaseTool_create_subtask: task_id is required");
    }

    if (!title || (typeof title === "string" && title.trim() === "")) {
      throw new Error("DatabaseTool_create_subtask: title is required");
    }

    let projectId;
    if (
      context &&
      typeof context.projectId === "string" &&
      context.projectId.trim() !== ""
    ) {
      projectId = context.projectId.trim();
    }

    const shouldTrace = !context?.__trace_from_toolrunner;

    // Log tool_call event
    if (shouldTrace) {
      try {
        await TraceService.logEvent({
          projectId,
          type: "tool_call",
          source: "tool",
          timestamp: new Date().toISOString(),
          summary: "DatabaseTool_create_subtask call",
          details: { taskId, title },
          requestId: context?.requestId,
        });
      } catch (err) {
        console.error("Trace logging failed for create_subtask call:", err);
      }
    }

    const targetFn =
      originalCreateSubtask ||
      (DatabaseToolInstance && DatabaseToolInstance.create_subtask) ||
      (DatabaseToolModule && DatabaseToolModule.create_subtask);
    if (typeof targetFn !== "function") {
      throw new Error(
        "DatabaseTool_create_subtask: underlying implementation is not available"
      );
    }

    const result = await targetFn(
      taskId,
      externalId,
      title,
      status,
      workflow_stage,
      basic_info,
      instruction,
      pcc,
      tests,
      implementation,
      review,
      reason
    );

    // Log tool_result event
    if (shouldTrace) {
      try {
        await TraceService.logEvent({
          projectId,
          type: "tool_result",
          source: "tool",
          timestamp: new Date().toISOString(),
          summary: "DatabaseTool_create_subtask result",
          details: { result },
          requestId: context?.requestId,
        });
      } catch (err) {
        console.error("Trace logging failed for create_subtask result:", err);
      }
    }

    return result;
  },

  // === list_subtasks_by_status ===
  async list_subtasks_by_status(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { status, limit, project_id: projectId, context } = args;
    if (!status) throw new Error("status is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.list_subtasks_by_status
        ? DatabaseToolInstance.list_subtasks_by_status.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(status, limit || 50, projectId || "P1");
  },

  // === search_subtasks_by_keyword ===
  async search_subtasks_by_keyword(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { keyword, limit, project_id: projectId, context } = args;
    if (!keyword) throw new Error("keyword is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.search_subtasks_by_keyword
        ? DatabaseToolInstance.search_subtasks_by_keyword.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(keyword, limit || 20, projectId || "P1");
  },

  // === safe_query ===
  async safe_query(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { sql, params, context } = args;
    if (!sql) throw new Error("sql is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.query
        ? DatabaseToolInstance.query.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(sql, params || []);
  },

  // === list_subtasks_for_task ===
  async list_subtasks_for_task(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const {
      task_id: taskId,
      status,
      include_details,
      project_id: projectId,
      context,
    } = args;
    if (!taskId) throw new Error("task_id is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.list_subtasks_for_task
        ? DatabaseToolInstance.list_subtasks_for_task.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(taskId, status, include_details, projectId || "P1");
  },

  // === create_feature ===
  async create_feature(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const {
      project_id: projectId,
      external_id: externalId,
      title,
      status,
      basic_info,
      pcc,
      cap,
      red,
      reason,
      context,
    } = args;
    if (!projectId) throw new Error("project_id is required");
    if (!title) throw new Error("title is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.create_feature
        ? DatabaseToolInstance.create_feature.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(
      projectId,
      externalId || null,
      title,
      status || "pending",
      basic_info || {},
      pcc || {},
      cap || {},
      red || {},
      reason || ""
    );
  },

  // === update_feature_sections ===
  async update_feature_sections(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { feature_id: featureId, changes, reason, context } = args;
    if (!featureId) throw new Error("feature_id is required");
    if (!changes) throw new Error("changes is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.update_feature_sections
        ? DatabaseToolInstance.update_feature_sections.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(featureId, changes, reason || "");
  },

  // === update_subtask_sections ===
  async update_subtask_sections(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { subtask_id: subtaskId, changes, reason, context } = args;
    if (!subtaskId) throw new Error("subtask_id is required");
    if (!changes) throw new Error("changes is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.update_subtask_sections
        ? DatabaseToolInstance.update_subtask_sections.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(subtaskId, changes, reason || "");
  },

  // === list_features_for_project ===
  async list_features_for_project(args) {
    if (!args || typeof args !== "object")
      throw new Error("args must be an object");
    const { project_id: projectId, context } = args;
    if (!projectId) throw new Error("project_id is required");

    const targetFn =
      DatabaseToolInstance && DatabaseToolInstance.list_features_for_project
        ? DatabaseToolInstance.list_features_for_project.bind(DatabaseToolInstance)
        : null;
    if (typeof targetFn !== "function")
      throw new Error("Implementation not available");

    return await targetFn(projectId);
  },
};

module.exports = DatabaseToolAgentAdapter;
