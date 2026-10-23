# Offline clinic contracts

These are previously written pure offline projection/validation functions. Relative imports were rebased to this handoff. Raw saved DOM/response fixtures, fixture loaders, actual results and live sample requests are omitted. No HTTP route or MCP server is registered. The proposed endpoint is explicitly unavailable here.

Preserve exact student/paper/attempt matching, ambiguous-header rejection, complete ordinal membership and unknown grading-enum rejection. Current wrong-item reads cannot establish historical similar-paper print membership. Official handlers may write before navigating; a handler name or HTTP method alone does not prove a read-only effect.
