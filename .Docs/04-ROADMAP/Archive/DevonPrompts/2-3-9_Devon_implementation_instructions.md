# Devon Implementation Instructions: WritePlanTool (2-3-9)

## 📋 **Objective**
Implement WritePlanTool - A reliable, validated file operation tool that prevents accidental data loss. This tool accepts a structured "Write Plan" (a list of operations) rather than a single raw file command.

## 🎯 **Acceptance Criteria**
- ✅ **Plan Schema:** Accepts `{ intent, operations: [...] }` object.
- ✅ **Operation Types:** `create`, `append`, `overwrite` (Phase 1).
- ✅ **Validation:** File existence checks before operations (fail create if exists; fail append/overwrite if missing).
- ✅ **Safety:** Auto-create parent directories if missing.
- ✅ **Feedback:** Return a structured report of actions taken (status/errors per operation).
- ✅ **Deferred:** Ignore complex edge cases (symlinks, large file streaming, disk full) for Phase 1.

## 📁 **File Structure**
```
backend/tools/
├── WritePlanTool.js              # Main implementation
└── __tests__/
    └── writePlanTool.test.js     # Tara's RED tests
```

## 🔧 **Implementation Requirements**

### **1. Core Functionality**
```javascript
// Required method signature
// plan: { intent?: string, operations: Array<{ type, target_file, content }> }
async executeWritePlan(plan)
```

### **2. Plan Schema & Validation**
- `plan` must be an object.
- `plan.operations` must be a non-empty array.
- Each operation must have:
  - `type`: 'create' | 'append' | 'overwrite'
  - `target_file`: non-empty string (relative path)
  - `content`: string (can be empty)

### **3. Operation Logic (Sequential Execution)**

#### **CREATE Operation:**
- **Pre-check:** File must NOT exist.
- **Action:** `fs.writeFile(path, content, 'utf8')`.
- **Error:** If file exists → return error status (do not throw entire plan).

#### **APPEND Operation:**
- **Pre-check:** File MUST exist.
- **Action:** `fs.appendFile(path, content, 'utf8')`.
- **Error:** If file doesn't exist → return error status.

#### **OVERWRITE Operation:**
- **Pre-check:** File MUST exist.
- **Action:** `fs.writeFile(path, content, 'utf8')`.
- **Error:** If file doesn't exist → return error status.

### **4. File System Details**
- Use `fs/promises` or `fs.promises`.
- **Auto-create parent directories:** `await fs.mkdir(path.dirname(absPath), { recursive: true })` before any write.
- Resolve `target_file` relative to `process.cwd()` or a configured root.

### **5. Return Value (Report)**
Instead of throwing on the first error, return a structured report:

```javascript
{
  intent: "optional intent from plan",
  results: [
    {
      operation_index: 0,
      type: "create",
      target_file: "path/to/file.txt",
      status: "success", // or "error"
      error: null        // or { code: "E_FILE_EXISTS", message: "..." }
    },
    // ...
  ]
}
```
*Note: You may choose to stop execution on the first error or continue; strict sequential dependency suggests stopping is safer, but returning the report is key.*

## 🧪 **Test Integration**

### **RED Tests to Make GREEN:**
1. **Plan validation** - Reject invalid plan structure.
2. **Operation rules** - Verify create/append/overwrite constraints.
3. **Directory creation** - Verify parent dirs are created.
4. **Report structure** - Verify output matches report schema.

### **Test Commands:**
```bash
cd backend
npm test -- writePlanTool.test.js
```

## 📝 **Implementation Steps**

### **Phase 1: Structure & Validation**
1. Create `backend/tools/WritePlanTool.js`.
2. Export `executeWritePlan(plan)`.
3. Implement basic validation of the `plan` object structure.

### **Phase 2: Execution Logic**
1. Iterate through `plan.operations`.
2. Implement path resolution & directory creation.
3. Implement logic for `create`, `append`, `overwrite` using `fs/promises`.

### **Phase 3: Reporting & Polish**
1. Capture success/failure for each operation.
2. Build and return the final JSON report.
3. Verify all Tara tests pass.

## 🔍 **Quality Checklist**

- [ ] All RED tests pass.
- [ ] Code handles parent directory creation automatically.
- [ ] Returns a report object, doesn't just throw (unless plan is malformed).
- [ ] No extra complexity (e.g. streaming, complex permission checks) - keep it simple for Phase 1.

## 🚀 **Success Metrics**
- ✅ `WritePlanTool` can execute a valid multi-step plan.
- ✅ Prevents overwriting on `create` and appending to non-existent files.
- ✅ Tara's tests are GREEN.

---

**Implementation Priority:** HIGH - Critical for safer Orion file operations.
**Dependencies:** None.
