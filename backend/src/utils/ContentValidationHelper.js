/**
 * ContentValidationHelper
 * Provides UTF-8 validation and repair capabilities for content before writing.
 * Implements the "Orion repair loop" for invalid characters (up to 3 attempts with batching,
 * then safe replacement with '').
 * 
 * @module ContentValidationHelper
 */

const { TextEncoder, TextDecoder } = require('util');

/**
 * Validate UTF-8 content and detect invalid characters.
 * 
 * @param {string} content - The content to validate.
 * @param {number} [chunkSize=1000] - Optional chunk size for validation (helps with large content).
 * @returns {Object} Validation result with isValid flag and error details.
 * @property {boolean} isValid - True if content is valid UTF-8.
 * @property {Array<Object>} errors - Array of error objects (empty if valid).
 * @property {number} errors[].position - Character position (0-indexed) of invalid byte.
 * @property {string} errors[].char - The invalid character (or placeholder).
 * @property {number} errors[].charCode - The character code.
 * @property {string} errors[].context - Surrounding context (approx 20 chars before/after).
 */
function validateUtf8(content, chunkSize = 1000) {
    const errors = [];
    
    if (typeof content !== 'string') {
        return {
            isValid: false,
            errors: [{
                position: 0,
                char: '[non-string]',
                charCode: 0,
                context: 'Content is not a string'
            }]
        };
    }
    
    if (content.length === 0) {
        return { isValid: true, errors: [] };
    }
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    
    // Validate in chunks to manage memory and provide better error positions
    const chunkCount = Math.ceil(content.length / chunkSize);
    
    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
        const start = chunkIdx * chunkSize;
        const end = Math.min(start + chunkSize, content.length);
        const chunk = content.substring(start, end);
        
        try {
            const encoded = encoder.encode(chunk);
            decoder.decode(encoded, { stream: chunkIdx < chunkCount - 1 });
        } catch (error) {
            // Find the exact invalid character within this chunk
            // Since we can't get precise position from TextDecoder error,
            // we'll scan character by character
            for (let i = 0; i < chunk.length; i++) {
                const subChunk = chunk.substring(0, i + 1);
                try {
                    const encoded = encoder.encode(subChunk);
                    decoder.decode(encoded, { stream: false });
                } catch (subError) {
                    // This character is invalid
                    const globalPos = start + i;
                    const contextStart = Math.max(0, globalPos - 20);
                    const contextEnd = Math.min(content.length, globalPos + 20);
                    const context = content.substring(contextStart, contextEnd);
                    
                    errors.push({
                        position: globalPos,
                        char: chunk[i],
                        charCode: chunk.charCodeAt(i),
                        context: context
                    });
                    
                    // Skip this character and continue scanning
                    // We'll break and move to next chunk position after i
                    // But we need to adjust the chunk to skip this bad char
                    // For simplicity, we'll continue scanning but decoder state is broken.
                    // We'll create a fresh decoder for the next iteration
                    decoder = new TextDecoder('utf-8', { fatal: true });
                    break;
                }
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Repair invalid content by asking Orion for fixes in a batched request.
 * This is a stub that needs integration with Orion's question-answering mechanism.
 * 
 * @param {string} content - Original content with invalid characters.
 * @param {Array<Object>} errors - Array of error objects from validateUtf8.
 * @param {string} [filePath] - Optional file path for context.
 * @returns {Promise<string|null>} Repaired content, or null if Orion cannot fix.
 */
async function repairWithOrion(content, errors, filePath = '') {
    // This is a stub implementation that should be replaced with actual Orion integration.
    // In a real implementation, this would:
    // 1. Build a batched repair prompt showing all invalid positions with context
    // 2. Send to Orion via ToolOrchestrator or similar
    // 3. Parse Orion's response and apply fixes
    // 4. Return repaired content
    
    console.warn('ContentValidationHelper.repairWithOrion: Orion repair not implemented, returning null');
    return null;
}

/**
 * Apply safe replacement for invalid characters (fallback after failed repair attempts).
 * Replaces invalid characters with Unicode REPLACEMENT CHARACTER ().
 * 
 * @param {string} content - Original content.
 * @param {Array<Object>} errors - Array of error objects from validateUtf8.
 * @returns {Object} Result with repaired content and replacement log.
 * @property {string} repairedContent - Content with invalid chars replaced by ''.
 * @property {Array<Object>} replacements - Log of replacements made.
 */
function applySafeReplacement(content, errors) {
    if (errors.length === 0) {
        return {
            repairedContent: content,
            replacements: []
        };
    }
    
    // Sort errors by position descending to avoid position shifts during replacement
    const sortedErrors = [...errors].sort((a, b) => b.position - a.position);
    const replacements = [];
    
    let repairedContent = content;
    
    for (const error of sortedErrors) {
        if (error.position >= 0 && error.position < repairedContent.length) {
            const before = repairedContent.substring(0, error.position);
            const after = repairedContent.substring(error.position + 1);
            repairedContent = before + '' + after;
            
            replacements.push({
                position: error.position,
                originalChar: error.char,
                originalCharCode: error.charCode,
                context: error.context
            });
        }
    }
    
    return {
        repairedContent,
        replacements
    };
}

/**
 * Execute the full repair loop with Orion (up to 3 attempts).
 * 
 * @param {string} content - Original content to validate and repair.
 * @param {string} [filePath] - Optional file path for context.
 * @returns {Promise<Object>} Repair result.
 * @property {string} finalContent - Final content after repair loop.
 * @property {boolean} usedSafeReplacement - Whether safe replacement was used.
 * @property {number} attempts - Number of repair attempts made.
 * @property {Array<Object>} repairLog - Log of repair operations.
 */
async function executeRepairLoop(content, filePath = '') {
    const repairLog = [];
    let currentContent = content;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        const validation = validateUtf8(currentContent);
        
        if (validation.isValid) {
            repairLog.push({
                attempt: attempts,
                status: 'valid',
                errors: 0
            });
            return {
                finalContent: currentContent,
                usedSafeReplacement: false,
                attempts,
                repairLog
            };
        }
        
        repairLog.push({
            attempt: attempts,
            status: 'invalid',
            errors: validation.errors.length
        });
        
        // Try to repair with Orion
        const repairedContent = await repairWithOrion(currentContent, validation.errors, filePath);
        
        if (repairedContent === null) {
            // Orion couldn't fix it, break loop and fall back to safe replacement
            repairLog.push({
                attempt: attempts,
                status: 'orion_failed'
            });
            break;
        }
        
        // Update content for next validation
        currentContent = repairedContent;
        attempts++;
    }
    
    // If we get here, either Orion failed or we exceeded max attempts
    const finalValidation = validateUtf8(currentContent);
    
    if (finalValidation.isValid) {
        return {
            finalContent: currentContent,
            usedSafeReplacement: false,
            attempts,
            repairLog
        };
    }
    
    // Apply safe replacement as final fallback
    const safeResult = applySafeReplacement(currentContent, finalValidation.errors);
    repairLog.push({
        attempt: attempts,
        status: 'safe_replacement',
        replacements: safeResult.replacements.length
    });
    
    return {
        finalContent: safeResult.repairedContent,
        usedSafeReplacement: true,
        attempts,
        repairLog,
        replacements: safeResult.replacements
    };
}

module.exports = {
    validateUtf8,
    repairWithOrion,
    applySafeReplacement,
    executeRepairLoop
};
