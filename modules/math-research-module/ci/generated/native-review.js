// @bun
var __esm = (fn, res, err) => () => {
  if (fn)
    try {
      res = fn(fn = 0);
    } catch (e) {
      err = [e];
    }
  if (err)
    throw err[0];
  return res;
};

// ontology-release:schemas/artifact.schema.json
var artifact_schema_default;
var init_artifact_schema = __esm(() => {
  artifact_schema_default = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.palantirkc.local/ontology/1.0.0/artifact.schema.json",
    title: "Artifact",
    description: "Canonical shared artifact contract. Domain-specific observations belong in details. Schema shape version is independent of package release version.",
    oneOf: [
      {
        $ref: "#/$defs/ProjectArtifact"
      },
      {
        $ref: "#/$defs/TaskArtifact"
      },
      {
        $ref: "#/$defs/ProposalArtifact"
      },
      {
        $ref: "#/$defs/DecisionArtifact"
      },
      {
        $ref: "#/$defs/EvidenceArtifact"
      },
      {
        $ref: "#/$defs/VerificationArtifact"
      },
      {
        $ref: "#/$defs/RunArtifact"
      }
    ],
    $defs: {
      JsonValue: {
        title: "JsonValue",
        anyOf: [
          {
            type: "null"
          },
          {
            type: "boolean"
          },
          {
            type: "number"
          },
          {
            type: "string"
          },
          {
            type: "array",
            items: {
              $ref: "#/$defs/JsonValue"
            }
          },
          {
            $ref: "#/$defs/JsonObject"
          }
        ]
      },
      JsonObject: {
        title: "JsonObject",
        type: "object",
        additionalProperties: {
          $ref: "#/$defs/JsonValue"
        }
      },
      ArtifactEnvelope: {
        title: "ArtifactEnvelope",
        type: "object",
        properties: {
          schemaVersion: {
            const: "1.0.0",
            type: "string"
          },
          kind: {
            type: "string",
            enum: [
              "project",
              "task",
              "proposal",
              "decision",
              "evidence",
              "verification",
              "run"
            ]
          },
          id: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
          },
          projectId: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]*$"
          },
          domainId: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]*$"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          references: {
            type: "array",
            items: {
              type: "object",
              properties: {
                artifactId: {
                  type: "string",
                  pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
                },
                relation: {
                  type: "string",
                  enum: [
                    "parent",
                    "supports",
                    "authorizes",
                    "implements",
                    "verifies",
                    "supersedes",
                    "derivedFrom",
                    "attemptOf",
                    "accepts"
                  ]
                },
                sha256: {
                  type: "string",
                  pattern: "^[a-f0-9]{64}$"
                }
              },
              required: [
                "artifactId",
                "relation"
              ],
              additionalProperties: false
            }
          },
          payload: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      ProjectPayload: {
        title: "ProjectPayload",
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 1
          },
          status: {
            enum: [
              "active",
              "archived"
            ],
            type: "string"
          },
          scope: {
            type: "string",
            minLength: 1
          },
          ontologyPackage: {
            type: "object",
            properties: {
              name: {
                const: "@palantirkc/ontology",
                type: "string"
              },
              version: {
                type: "string",
                pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$"
              }
            },
            required: [
              "name",
              "version"
            ],
            additionalProperties: false
          },
          commands: {
            type: "object",
            minProperties: 1,
            additionalProperties: {
              type: "string",
              minLength: 1
            }
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "name",
          "status",
          "scope",
          "ontologyPackage",
          "commands"
        ],
        additionalProperties: false
      },
      TaskPayload: {
        title: "TaskPayload",
        type: "object",
        properties: {
          title: {
            type: "string",
            minLength: 1
          },
          objective: {
            type: "string",
            minLength: 1
          },
          status: {
            enum: [
              "planned",
              "running",
              "complete",
              "blocked",
              "cancelled"
            ],
            type: "string"
          },
          acceptanceCriteria: {
            type: "array",
            items: {
              type: "string",
              minLength: 1
            },
            uniqueItems: true,
            minItems: 1
          },
          verificationRefs: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
            },
            uniqueItems: true
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "title",
          "objective",
          "status",
          "acceptanceCriteria"
        ],
        additionalProperties: false
      },
      ProposalPayload: {
        title: "ProposalPayload",
        type: "object",
        properties: {
          title: {
            type: "string",
            minLength: 1
          },
          status: {
            enum: [
              "draft",
              "proposed",
              "withdrawn"
            ],
            type: "string"
          },
          recommendation: {
            type: "string",
            minLength: 1
          },
          alternatives: {
            type: "array",
            items: {
              type: "string",
              minLength: 1
            },
            uniqueItems: true
          },
          evidenceRefs: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
            },
            uniqueItems: true
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "title",
          "status",
          "recommendation",
          "alternatives",
          "evidenceRefs"
        ],
        additionalProperties: false
      },
      DecisionPayload: {
        title: "DecisionPayload",
        type: "object",
        properties: {
          title: {
            type: "string",
            minLength: 1
          },
          status: {
            enum: [
              "accepted",
              "rejected",
              "superseded"
            ],
            type: "string"
          },
          choice: {
            type: "string",
            minLength: 1
          },
          rationale: {
            type: "string",
            minLength: 1
          },
          evidenceRefs: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
            },
            uniqueItems: true
          },
          proposalRef: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
          },
          authority: {
            type: "object",
            properties: {
              actorType: {
                type: "string",
                enum: [
                  "user",
                  "project-owner"
                ]
              },
              actorId: {
                type: "string",
                minLength: 1
              },
              sourceEvidenceRef: {
                type: "string",
                pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
              },
              scope: {
                type: "string",
                minLength: 1
              }
            },
            required: [
              "actorType",
              "actorId",
              "sourceEvidenceRef",
              "scope"
            ],
            additionalProperties: false
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "title",
          "status",
          "choice",
          "rationale",
          "evidenceRefs"
        ],
        additionalProperties: false
      },
      EvidencePayload: {
        title: "EvidencePayload",
        type: "object",
        properties: {
          claim: {
            type: "string",
            minLength: 1
          },
          method: {
            type: "string",
            minLength: 1
          },
          sourceUrl: {
            type: "string",
            format: "uri"
          },
          fetchedAt: {
            type: "string",
            format: "date-time"
          },
          upstreamRevision: {
            type: "string",
            minLength: 1
          },
          result: {
            type: "object",
            properties: {
              outcome: {
                type: "string",
                enum: [
                  "success",
                  "failure",
                  "partial"
                ]
              },
              processExitCode: {
                type: [
                  "integer",
                  "null"
                ]
              },
              contentMatched: {
                type: [
                  "boolean",
                  "null"
                ]
              },
              details: {
                $ref: "#/$defs/JsonObject"
              }
            },
            required: [
              "outcome",
              "processExitCode",
              "contentMatched"
            ],
            additionalProperties: false
          },
          attempts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                attempt: {
                  type: "integer",
                  minimum: 1
                },
                outcome: {
                  type: "string",
                  enum: [
                    "success",
                    "failure"
                  ]
                },
                error: {
                  type: "string",
                  minLength: 1
                },
                details: {
                  $ref: "#/$defs/JsonObject"
                }
              },
              required: [
                "attempt",
                "outcome"
              ],
              additionalProperties: false
            }
          },
          limitations: {
            type: "array",
            items: {
              type: "string",
              minLength: 1
            },
            uniqueItems: true
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "claim",
          "method",
          "sourceUrl",
          "fetchedAt",
          "result",
          "attempts",
          "limitations"
        ],
        additionalProperties: false
      },
      VerificationPayload: {
        title: "VerificationPayload",
        type: "object",
        properties: {
          targetRefs: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
            },
            uniqueItems: true,
            minItems: 1
          },
          criteria: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  minLength: 1
                },
                status: {
                  type: "string",
                  enum: [
                    "pass",
                    "fail",
                    "unverified"
                  ]
                },
                message: {
                  type: "string",
                  minLength: 1
                },
                evidenceRefs: {
                  type: "array",
                  items: {
                    type: "string",
                    pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
                  },
                  uniqueItems: true
                }
              },
              required: [
                "id",
                "status",
                "message",
                "evidenceRefs"
              ],
              additionalProperties: false
            }
          },
          inputHashes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  minLength: 1
                },
                sha256: {
                  type: "string",
                  pattern: "^[a-f0-9]{64}$"
                }
              },
              required: [
                "path",
                "sha256"
              ],
              additionalProperties: false
            }
          },
          runtime: {
            type: "object",
            properties: {
              name: {
                type: "string",
                minLength: 1
              },
              version: {
                type: "string",
                minLength: 1
              }
            },
            required: [
              "name",
              "version"
            ],
            additionalProperties: false
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "targetRefs",
          "criteria",
          "inputHashes",
          "runtime"
        ],
        additionalProperties: false
      },
      RunPayload: {
        title: "RunPayload",
        type: "object",
        properties: {
          taskRef: {
            type: "string",
            pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
          },
          state: {
            type: "string",
            enum: [
              "running",
              "completed",
              "failed",
              "interrupted"
            ]
          },
          startedAt: {
            type: "string",
            format: "date-time"
          },
          finishedAt: {
            anyOf: [
              {
                type: "string",
                format: "date-time"
              },
              {
                type: "null"
              }
            ]
          },
          inputHashes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  minLength: 1
                },
                sha256: {
                  type: "string",
                  pattern: "^[a-f0-9]{64}$"
                }
              },
              required: [
                "path",
                "sha256"
              ],
              additionalProperties: false
            }
          },
          runtime: {
            type: "object",
            properties: {
              name: {
                type: "string",
                minLength: 1
              },
              version: {
                type: "string",
                minLength: 1
              }
            },
            required: [
              "name",
              "version"
            ],
            additionalProperties: false
          },
          evidenceRefs: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
            },
            uniqueItems: true
          },
          verificationRefs: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$"
            },
            uniqueItems: true
          },
          details: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "taskRef",
          "state",
          "startedAt",
          "finishedAt",
          "inputHashes",
          "runtime",
          "evidenceRefs",
          "verificationRefs"
        ],
        additionalProperties: false
      },
      ProjectArtifact: {
        title: "ProjectArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "project",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/ProjectPayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      TaskArtifact: {
        title: "TaskArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "task",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/TaskPayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      ProposalArtifact: {
        title: "ProposalArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "proposal",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/ProposalPayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      DecisionArtifact: {
        title: "DecisionArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "decision",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/DecisionPayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      EvidenceArtifact: {
        title: "EvidenceArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "evidence",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/EvidencePayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      VerificationArtifact: {
        title: "VerificationArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "verification",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/VerificationPayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      },
      RunArtifact: {
        title: "RunArtifact",
        type: "object",
        properties: {
          schemaVersion: {
            $ref: "#/$defs/ArtifactEnvelope/properties/schemaVersion"
          },
          kind: {
            const: "run",
            type: "string"
          },
          id: {
            $ref: "#/$defs/ArtifactEnvelope/properties/id"
          },
          projectId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/projectId"
          },
          domainId: {
            $ref: "#/$defs/ArtifactEnvelope/properties/domainId"
          },
          createdAt: {
            $ref: "#/$defs/ArtifactEnvelope/properties/createdAt"
          },
          references: {
            $ref: "#/$defs/ArtifactEnvelope/properties/references"
          },
          payload: {
            $ref: "#/$defs/RunPayload"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "projectId",
          "domainId",
          "createdAt",
          "payload"
        ],
        additionalProperties: false
      }
    }
  };
});

// ontology-release:dist/schema.js
var schema_default;
var init_schema = __esm(() => {
  init_artifact_schema();
  schema_default = artifact_schema_default;
});

// ontology-release:dist/json-validation.js
function jsonIssue(value, path = "", parents = new WeakSet) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value))
    return;
  if (typeof value !== "object")
    return { code: "non-json-value", path, message: "Value must be finite, plain JSON." };
  if (parents.has(value))
    return { code: "cyclic-json", path, message: "JSON cannot contain an object cycle." };
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return { code: "non-json-object", path, message: "JSON objects must be plain objects." };
  }
  parents.add(value);
  for (const [key, nested] of Object.entries(value)) {
    const issue = jsonIssue(nested, `${path}/${key}`, parents);
    if (issue)
      return issue;
  }
  parents.delete(value);
}

// ontology-release:dist/validation.js
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
function validateArtifact(value) {
  const invalidJson = jsonIssue(value);
  if (invalidJson)
    return { valid: false, issues: [invalidJson] };
  if (!validateShape(value)) {
    return { valid: false, issues: (validateShape.errors ?? []).map((error) => ({ code: `schema:${error.keyword}`, path: error.instancePath, message: error.message ?? "Schema validation failed." })) };
  }
  const issues = [];
  const issue = (code, path, message) => issues.push({ code, path, message });
  if (!value.id.startsWith(`${value.projectId}:${value.kind}:`))
    issue("identity-mismatch", "/id", "ID project and kind must match the envelope.");
  if (value.kind === "decision" && value.payload.status === "accepted" && !value.payload.authority) {
    issue("missing-authority", "/payload/authority", "An accepted decision requires a scoped authority declaration.");
  }
  if (value.kind === "task" && value.payload.status === "complete" && !value.payload.verificationRefs?.length) {
    issue("missing-completion-verification", "/payload/verificationRefs", "A completed task requires verification references.");
  }
  if (value.kind === "evidence") {
    if (value.payload.result.outcome === "success" && value.payload.result.processExitCode !== null && value.payload.result.processExitCode !== 0) {
      issue("contradictory-exit", "/payload/result", "Successful evidence cannot declare a nonzero process exit code.");
    }
    value.payload.attempts.forEach((attempt, index) => {
      if (attempt.attempt !== index + 1)
        issue("attempt-order", `/payload/attempts/${index}/attempt`, "Attempts must retain contiguous execution order starting at 1.");
      if (attempt.outcome === "failure" && !attempt.error)
        issue("missing-attempt-failure", `/payload/attempts/${index}/error`, "A failed attempt requires its observed failure message.");
    });
    if (value.payload.result.outcome === "success" && value.payload.attempts.at(-1)?.outcome === "failure") {
      issue("contradictory-final-attempt", "/payload/result/outcome", "Successful evidence must retain a final successful attempt after failures.");
    }
  }
  if (value.kind === "verification") {
    const ids = new Set;
    value.payload.criteria.forEach((criterion, index) => {
      if (ids.has(criterion.id))
        issue("duplicate-criterion", `/payload/criteria/${index}/id`, "Criterion IDs must be unique within the verification.");
      ids.add(criterion.id);
      if (criterion.status !== "unverified" && !criterion.evidenceRefs.length)
        issue("unsupported-result", `/payload/criteria/${index}/evidenceRefs`, "Pass or fail results require observed evidence.");
    });
  }
  if (value.kind === "run") {
    if (value.payload.state === "running" && value.payload.finishedAt !== null)
      issue("running-finished", "/payload/finishedAt", "A running execution has no finish timestamp.");
    if (value.payload.state !== "running" && value.payload.finishedAt === null)
      issue("terminal-unfinished", "/payload/finishedAt", "A terminal execution requires its finish timestamp.");
    if (value.payload.finishedAt !== null && Date.parse(value.payload.finishedAt) < Date.parse(value.payload.startedAt))
      issue("negative-duration", "/payload/finishedAt", "Finish time cannot precede start time.");
  }
  if (value.kind === "run" || value.kind === "verification") {
    const paths = new Set;
    value.payload.inputHashes.forEach((input, index) => {
      if (paths.has(input.path))
        issue("duplicate-input", `/payload/inputHashes/${index}/path`, "Each input path has one fingerprint within this record.");
      paths.add(input.path);
    });
  }
  return issues.length ? { valid: false, issues } : { valid: true, value, issues: [] };
}
function validateReferences(records) {
  const issues = [];
  const artifacts = new Map;
  const issue = (code, path, message) => issues.push({ code, path, message });
  for (const [index, record] of records.entries()) {
    const result = validateArtifact(record);
    if (!result.valid) {
      issues.push(...result.issues.map((item) => ({ ...item, path: `/records/${index}${item.path}` })));
      continue;
    }
    if (artifacts.has(result.value.id))
      issue("duplicate-id", `/records/${index}/id`, `Duplicate artifact ID ${result.value.id}.`);
    else
      artifacts.set(result.value.id, result.value);
  }
  const resolve = (id, path, kind) => {
    const target = artifacts.get(id);
    if (!target)
      issue("dangling-reference", path, `Referenced artifact ${id} was not supplied.`);
    else if (kind && target.kind !== kind)
      issue("reference-kind", path, `Expected ${kind}, found ${target.kind}.`);
    return target && (!kind || target.kind === kind) ? target : undefined;
  };
  const evidence = (id, path) => {
    const target = resolve(id, path, "evidence");
    return target?.kind === "evidence" ? target : undefined;
  };
  const verification = (id, path) => {
    const target = resolve(id, path, "verification");
    return target?.kind === "verification" ? target : undefined;
  };
  for (const artifact of artifacts.values()) {
    const base = `/artifacts/${artifact.id}`;
    for (const [index, reference] of (artifact.references ?? []).entries()) {
      const target = resolve(reference.artifactId, `${base}/references/${index}`);
      if (reference.artifactId === artifact.id)
        issue("self-reference", `${base}/references/${index}`, "An artifact cannot declare itself as a related predecessor or support.");
      if (reference.relation === "supersedes" && target && target.kind !== artifact.kind)
        issue("supersedes-kind", `${base}/references/${index}`, "A correction supersedes the same artifact kind.");
    }
    if (artifact.kind === "proposal" || artifact.kind === "decision" || artifact.kind === "run") {
      artifact.payload.evidenceRefs.forEach((id, index) => evidence(id, `${base}/payload/evidenceRefs/${index}`));
    }
    if (artifact.kind === "decision") {
      if (artifact.payload.proposalRef)
        resolve(artifact.payload.proposalRef, `${base}/payload/proposalRef`, "proposal");
      const authority = artifact.payload.authority;
      if (artifact.payload.status === "accepted" && authority) {
        const source = evidence(authority.sourceEvidenceRef, `${base}/payload/authority/sourceEvidenceRef`);
        const declaration = source?.payload.details?.authority;
        if (source && (source.payload.result.outcome !== "success" || typeof declaration !== "object" || declaration === null || Array.isArray(declaration) || declaration.actorType !== authority.actorType || declaration.actorId !== authority.actorId || declaration.scope !== authority.scope)) {
          issue("authority-scope-mismatch", `${base}/payload/authority`, "Authority evidence must explicitly declare the same actor and scope and have a successful observation.");
        }
      }
    }
    if (artifact.kind === "verification") {
      artifact.payload.targetRefs.forEach((id, index) => resolve(id, `${base}/payload/targetRefs/${index}`));
      artifact.payload.criteria.forEach((criterion, index) => criterion.evidenceRefs.forEach((id, refIndex) => {
        const source = evidence(id, `${base}/payload/criteria/${index}/evidenceRefs/${refIndex}`);
        if (criterion.status === "pass" && source && (source.payload.result.outcome !== "success" || source.payload.result.contentMatched === false)) {
          issue("inapplicable-pass-evidence", `${base}/payload/criteria/${index}`, "Passing criteria require successful evidence with no observed content mismatch.");
        }
      }));
    }
    if (artifact.kind === "task") {
      (artifact.payload.verificationRefs ?? []).forEach((id, index) => {
        const receipt = verification(id, `${base}/payload/verificationRefs/${index}`);
        if (artifact.payload.status === "complete" && receipt && (!receipt.payload.targetRefs.includes(artifact.id) || receipt.payload.criteria.some((criterion) => criterion.status !== "pass"))) {
          issue("incomplete-task-verification", `${base}/payload/verificationRefs/${index}`, "Task completion requires a receipt targeting this task with all declared criteria passing.");
        }
      });
    }
    if (artifact.kind === "run") {
      resolve(artifact.payload.taskRef, `${base}/payload/taskRef`, "task");
      artifact.payload.verificationRefs.forEach((id, index) => verification(id, `${base}/payload/verificationRefs/${index}`));
    }
  }
  const visiting = new Set;
  const visited = new Set;
  const visit = (id) => {
    if (visiting.has(id)) {
      issue("supersedes-cycle", `/artifacts/${id}/references`, "The supersedes relation cannot contain a cycle.");
      return;
    }
    if (visited.has(id))
      return;
    visiting.add(id);
    for (const reference of artifacts.get(id)?.references ?? [])
      if (reference.relation === "supersedes" && artifacts.has(reference.artifactId))
        visit(reference.artifactId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of artifacts.keys())
    visit(id);
  return { valid: issues.length === 0, issues };
}
var ajv, validateShape;
var init_validation = __esm(() => {
  init_schema();
  ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  addFormats(ajv);
  validateShape = ajv.compile(schema_default);
});

// ontology-release:dist/contracts.js
var init_contracts = __esm(() => {
  init_validation();
});

// ontology-release:ontology/upper/vocabulary.json
var vocabulary_default;
var init_vocabulary = __esm(() => {
  vocabulary_default = {
    schemaVersion: "1.0.0",
    id: "upper",
    terms: ["artifact", "project", "task", "decision", "evidence", "verification", "run", "reference", "authority", "version", "scope"],
    relations: ["parent", "supports", "authorizes", "implements", "verifies", "supersedes", "derivedFrom", "attemptOf", "accepts"],
    dependencyRule: "Upper vocabulary does not depend on domain modules."
  };
});

// ontology-release:dist/upper.js
var upperVocabulary;
var init_upper = __esm(() => {
  init_vocabulary();
  upperVocabulary = Object.freeze(vocabulary_default);
});

// ontology-release:schemas/operational.schema.json
var operational_schema_default;
var init_operational_schema = __esm(() => {
  operational_schema_default = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.palantirkc.local/ontology/operational/1.0.0/operational.schema.json",
    title: "OperationalRecord",
    description: "Versioned local Ontology contracts. Cardinality on an endpoint counts linked opposite endpoints per object of this endpoint's type. These contracts do not establish authority or transact external systems.",
    oneOf: [
      {
        $ref: "#/$defs/ObjectTypeDefinition"
      },
      {
        $ref: "#/$defs/LinkTypeDefinition"
      },
      {
        $ref: "#/$defs/ActionTypeDefinition"
      },
      {
        $ref: "#/$defs/OntologyRegistry"
      },
      {
        $ref: "#/$defs/ObjectRecord"
      },
      {
        $ref: "#/$defs/LinkRecord"
      },
      {
        $ref: "#/$defs/ActionRequest"
      },
      {
        $ref: "#/$defs/ActionExecution"
      }
    ],
    $defs: {
      JsonValue: {
        title: "JsonValue",
        anyOf: [
          {
            type: "null"
          },
          {
            type: "boolean"
          },
          {
            type: "number"
          },
          {
            type: "string"
          },
          {
            type: "array",
            items: {
              $ref: "#/$defs/JsonValue"
            }
          },
          {
            $ref: "#/$defs/JsonObject"
          }
        ]
      },
      JsonObject: {
        title: "JsonObject",
        type: "object",
        additionalProperties: {
          $ref: "#/$defs/JsonValue"
        }
      },
      PropertyDefinition: {
        title: "PropertyDefinition",
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          valueType: {
            type: "string",
            enum: [
              "string",
              "number",
              "integer",
              "boolean",
              "object",
              "array",
              "null",
              "json"
            ]
          },
          required: {
            type: "boolean"
          },
          immutable: {
            type: "boolean"
          },
          description: {
            type: "string"
          },
          format: {
            type: "string"
          },
          enum: {
            type: "array",
            items: {
              $ref: "#/$defs/JsonValue"
            },
            minItems: 1
          },
          reference: {
            title: "PropertyReference",
            type: "object",
            properties: {
              objectType: {
                type: "string",
                minLength: 1,
                maxLength: 512
              },
              many: {
                type: "boolean"
              }
            },
            required: [
              "objectType",
              "many"
            ],
            additionalProperties: false
          }
        },
        required: [
          "name",
          "valueType",
          "required"
        ],
        additionalProperties: false
      },
      IdentityDefinition: {
        title: "IdentityDefinition",
        type: "object",
        properties: {
          property: {
            type: "string",
            const: "id"
          },
          strategy: {
            type: "string",
            enum: [
              "provided",
              "uuid",
              "content-hash",
              "composite"
            ]
          },
          immutable: {
            type: "boolean",
            const: true
          },
          prefix: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          components: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
              maxLength: 512
            },
            minItems: 1,
            uniqueItems: true
          }
        },
        required: [
          "property",
          "strategy",
          "immutable"
        ],
        additionalProperties: false
      },
      ObjectTypeDefinition: {
        title: "ObjectTypeDefinition",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "object-type"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          version: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          domainId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          identity: {
            $ref: "#/$defs/IdentityDefinition"
          },
          properties: {
            type: "array",
            items: {
              $ref: "#/$defs/PropertyDefinition"
            }
          },
          additionalProperties: {
            type: "boolean"
          },
          description: {
            type: "string"
          },
          propertySchemaRef: {
            type: "string"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "version",
          "name",
          "domainId",
          "identity",
          "properties",
          "additionalProperties"
        ],
        additionalProperties: false
      },
      LinkCardinality: {
        title: "LinkCardinality",
        type: "object",
        properties: {
          min: {
            type: "integer",
            minimum: 0
          },
          max: {
            anyOf: [
              {
                type: "integer",
                minimum: 0
              },
              {
                type: "null"
              }
            ]
          }
        },
        required: [
          "min",
          "max"
        ],
        additionalProperties: false
      },
      LinkEndpointDefinition: {
        title: "LinkEndpointDefinition",
        type: "object",
        properties: {
          objectType: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          cardinality: {
            $ref: "#/$defs/LinkCardinality"
          }
        },
        required: [
          "objectType",
          "cardinality"
        ],
        additionalProperties: false
      },
      LinkTypeDefinition: {
        title: "LinkTypeDefinition",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "link-type"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          version: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          from: {
            $ref: "#/$defs/LinkEndpointDefinition"
          },
          to: {
            $ref: "#/$defs/LinkEndpointDefinition"
          },
          description: {
            type: "string"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "version",
          "name",
          "from",
          "to"
        ],
        additionalProperties: false
      },
      ActionPrecondition: {
        title: "ActionPrecondition",
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "version-match",
              "object-exists",
              "custom"
            ]
          },
          inputPath: {
            type: "string"
          },
          objectType: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          handler: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          description: {
            type: "string"
          }
        },
        required: [
          "kind"
        ],
        additionalProperties: false
      },
      ActionHandler: {
        title: "ActionHandler",
        type: "object",
        properties: {
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          version: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          scope: {
            type: "string",
            const: "local"
          }
        },
        required: [
          "id",
          "version",
          "scope"
        ],
        additionalProperties: false
      },
      ActionTypeDefinition: {
        title: "ActionTypeDefinition",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "action-type"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          version: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          inputSchema: {
            $ref: "#/$defs/JsonObject"
          },
          preconditions: {
            type: "array",
            items: {
              $ref: "#/$defs/ActionPrecondition"
            }
          },
          handler: {
            $ref: "#/$defs/ActionHandler"
          },
          idempotency: {
            title: "ActionIdempotency",
            type: "object",
            properties: {
              required: {
                type: "boolean",
                const: true
              },
              keyScope: {
                type: "string",
                const: "action-type-and-project"
              }
            },
            required: [
              "required",
              "keyScope"
            ],
            additionalProperties: false
          },
          effects: {
            title: "ActionEffects",
            type: "object",
            properties: {
              objectTypes: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                  maxLength: 512
                },
                uniqueItems: true
              },
              linkTypes: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                  maxLength: 512
                },
                uniqueItems: true
              }
            },
            required: [
              "objectTypes",
              "linkTypes"
            ],
            additionalProperties: false
          },
          description: {
            type: "string"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "version",
          "name",
          "inputSchema",
          "preconditions",
          "handler",
          "idempotency",
          "effects"
        ],
        additionalProperties: false
      },
      OntologyRegistry: {
        title: "OntologyRegistry",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          version: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          objectTypes: {
            type: "array",
            items: {
              $ref: "#/$defs/ObjectTypeDefinition"
            },
            minItems: 1
          },
          linkTypes: {
            type: "array",
            items: {
              $ref: "#/$defs/LinkTypeDefinition"
            }
          },
          actionTypes: {
            type: "array",
            items: {
              $ref: "#/$defs/ActionTypeDefinition"
            }
          }
        },
        required: [
          "schemaVersion",
          "id",
          "version",
          "objectTypes",
          "linkTypes",
          "actionTypes"
        ],
        additionalProperties: false
      },
      ObjectRecord: {
        title: "ObjectRecord",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "object"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          objectType: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          objectTypeVersion: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          version: {
            type: "integer",
            minimum: 1
          },
          projectId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          scope: {
            type: "string",
            enum: [
              "project",
              "shared"
            ]
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          },
          properties: {
            $ref: "#/$defs/JsonObject"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "objectType",
          "objectTypeVersion",
          "version",
          "projectId",
          "scope",
          "createdAt",
          "updatedAt",
          "properties"
        ],
        additionalProperties: false
      },
      LinkRecord: {
        title: "LinkRecord",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "link"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          linkType: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          linkTypeVersion: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          version: {
            type: "integer",
            minimum: 1
          },
          from: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          to: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          projectId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          scope: {
            type: "string",
            enum: [
              "project",
              "shared"
            ]
          },
          createdAt: {
            type: "string",
            format: "date-time"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "linkType",
          "linkTypeVersion",
          "version",
          "from",
          "to",
          "projectId",
          "scope",
          "createdAt"
        ],
        additionalProperties: false
      },
      ActionExpectedVersion: {
        title: "ActionExpectedVersion",
        type: "object",
        properties: {
          objectId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          version: {
            type: "integer",
            minimum: 1
          }
        },
        required: [
          "objectId",
          "version"
        ],
        additionalProperties: false
      },
      ActionRequest: {
        title: "ActionRequest",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "action-request"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          actionType: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          actionTypeVersion: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          projectId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          idempotencyKey: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          input: {
            $ref: "#/$defs/JsonObject"
          },
          expectedVersions: {
            type: "array",
            items: {
              $ref: "#/$defs/ActionExpectedVersion"
            }
          },
          simulate: {
            type: "boolean"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "actionType",
          "actionTypeVersion",
          "projectId",
          "idempotencyKey",
          "input",
          "expectedVersions",
          "simulate",
          "createdAt"
        ],
        additionalProperties: false
      },
      ActionDiagnostic: {
        title: "ActionDiagnostic",
        type: "object",
        properties: {
          code: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          message: {
            type: "string"
          },
          objectId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          }
        },
        required: [
          "code",
          "message"
        ],
        additionalProperties: false
      },
      ActionExecution: {
        title: "ActionExecution",
        type: "object",
        properties: {
          schemaVersion: {
            type: "string",
            const: "1.0.0"
          },
          kind: {
            type: "string",
            const: "action-execution"
          },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          requestId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          actionType: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          actionTypeVersion: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          handlerVersion: {
            type: "string",
            pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$"
          },
          projectId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          idempotencyKey: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          outcome: {
            type: "string",
            enum: [
              "success",
              "failure",
              "simulated"
            ]
          },
          startedAt: {
            type: "string",
            format: "date-time"
          },
          finishedAt: {
            type: "string",
            format: "date-time"
          },
          committedBatchId: {
            type: "string",
            minLength: 1,
            maxLength: 512
          },
          result: {
            $ref: "#/$defs/JsonValue"
          },
          diagnostics: {
            type: "array",
            items: {
              $ref: "#/$defs/ActionDiagnostic"
            }
          }
        },
        required: [
          "schemaVersion",
          "kind",
          "id",
          "requestId",
          "actionType",
          "actionTypeVersion",
          "handlerVersion",
          "projectId",
          "idempotencyKey",
          "outcome",
          "startedAt",
          "finishedAt",
          "result",
          "diagnostics"
        ],
        additionalProperties: false
      }
    }
  };
});

// ontology-release:dist/operational-validation.js
import Ajv20202 from "ajv/dist/2020.js";
import addFormats2 from "ajv-formats";
var ajv2, validator = (definition) => ajv2.compile({ $ref: `${operational_schema_default.$id}#/$defs/${definition}` }), shape, objectShape, linkShape, registryShape, requestShape;
var init_operational_validation = __esm(() => {
  init_operational_schema();
  ajv2 = new Ajv20202({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  addFormats2(ajv2);
  ajv2.addSchema(operational_schema_default);
  shape = ajv2.compile(operational_schema_default);
  objectShape = validator("ObjectRecord");
  linkShape = validator("LinkRecord");
  registryShape = validator("OntologyRegistry");
  requestShape = validator("ActionRequest");
});

// ontology-release:dist/operational.js
var init_operational = __esm(() => {
  init_operational_schema();
  init_operational_validation();
});

// ontology-release:dist/index.js
var init_dist = __esm(() => {
  init_upper();
  init_schema();
  init_operational();
  init_contracts();
});

// review-source:ci/quality/receipt-validator.ts
import { createHash } from "crypto";
var hash = (value) => createHash("sha256").update(value).digest("hex");
var object = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
var fullSha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
var digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var taskId = (value) => typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value && !/[\s\u0000-\u001f\u007f]/.test(value);
function deriveReviewedSourceManifest(response, tree) {
  const value = object(response);
  if (!fullSha(tree) || value.sha !== tree || value.truncated !== false || !Array.isArray(value.tree) || value.tree.length < 1 || value.tree.length > 4096) {
    throw new Error("Reviewed source tree is unavailable, truncated or outside the manifest bound");
  }
  const seen = new Set;
  const entries = value.tree.map((entry) => {
    const item = object(entry);
    if (typeof item.path !== "string" || !item.path || item.path.length > 512 || /[\\\u0000-\u001f\u007f]/.test(item.path) || item.path.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment === ".git") || seen.has(item.path) || !fullSha(item.sha) || !(item.type === "tree" && item.mode === "040000" || item.type === "blob" && ["100644", "100755", "120000"].includes(String(item.mode)))) {
      throw new Error("Reviewed source tree contains duplicate, unsafe or unsupported entries");
    }
    seen.add(item.path);
    return {
      path: item.path,
      mode: String(item.mode),
      type: item.type,
      sha: item.sha
    };
  });
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const blobCount = entries.filter((entry) => entry.type === "blob").length;
  if (!blobCount)
    throw new Error("Reviewed source manifest contains no source blobs");
  return {
    schema: "agent-platform.reviewed-source-manifest.v1",
    reviewedTreeSha: tree,
    entryCount: entries.length,
    blobCount,
    sha256: hash(`agent-platform.reviewed-source-manifest.v1
` + JSON.stringify(entries))
  };
}
function decodeBoundedReviewFile(content, path, maximumBytes) {
  const value = object(content);
  if (value.type !== "file" || value.path !== path || value.encoding !== "base64" || typeof value.content !== "string" || !Number.isSafeInteger(value.size) || typeof value.size !== "number" || value.size <= 0 || value.size > maximumBytes) {
    throw new Error("Independent review file is not a bounded repository file");
  }
  const base64 = value.content.replace(/\n/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("Independent review file is not valid base64");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length !== value.size)
    throw new Error("Independent review file byte size mismatch");
  return bytes;
}
function validateExactNativeReview(value, head, tree, manifestSha256) {
  const reviewer = object(value.reviewer), author = object(value.author);
  if (!fullSha(head) || !fullSha(tree) || !digest(manifestSha256) || value.headSha !== head || value.reviewedTreeSha !== tree || value.reviewedSourceManifestSha256 !== manifestSha256 || reviewer.runtime !== "native-codex" || author.runtime !== "native-codex" || !taskId(reviewer.taskId) || !taskId(author.taskId) || reviewer.taskId === author.taskId || value.conclusion !== "pass" || value.unresolvedFindings !== 0)
    throw new Error("Review does not prove exact source and independent native identities");
}
function validateOwnerReviewPolicy(policy) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(policy.repository) || ![policy.projectId, policy.domainId, policy.semanticOwner, policy.scope].every(taskId) || policy.statusContext !== "native-independent-review" || !/^[1-9][0-9]*$/.test(policy.publisher.id) || !taskId(policy.publisher.login) || !["User", "Bot"].includes(policy.publisher.type))
    throw new Error("Owner review requires explicit reviewed repository, semantic and publisher policy");
}
function validateOwnerReviewProof(value, policy, head, tree, manifest, identities) {
  const proof = object(value), binding = object(proof.binding);
  const keys = ["repository", "projectId", "domainId", "semanticOwner", "scope"];
  if (Object.keys(binding).sort().join("|") !== [...keys].sort().join("|") || keys.some((key) => binding[key] !== policy[key]))
    throw new Error("Owner review binding differs from fixed owner policy");
  validateExactNativeReview(proof, head, tree, manifest);
  if (identities && (object(proof.reviewer).taskId !== identities.reviewer.taskId || object(proof.author).taskId !== identities.author.taskId))
    throw new Error("Owner review native identities differ across immutable evidence");
}
function immutableOwnerReviewTarget(value, policy, head, role) {
  const reference = object(value), path = `${role}/${head}.json`;
  if (!fullSha(reference.commit) || reference.commit === head || reference.path !== path || !digest(reference.sha256) || Object.keys(reference).sort().join("|") !== "commit|path|sha256")
    throw new Error("Owner review evidence requires exact immutable role, commit and digest");
  validateOwnerReviewPolicy(policy);
  return { commit: reference.commit, path, sha256: reference.sha256 };
}
function immutableOwnerReviewUrl(url, policy, head, role) {
  if (typeof url !== "string")
    throw new Error("Owner review immutable URL missing");
  const prefix = `https://github.com/${policy.repository}/blob/`;
  const path = `${role}/${head}.json`, suffix = "/" + path;
  const commit = url.startsWith(prefix) && url.endsWith(suffix) ? url.slice(prefix.length, -suffix.length) : "";
  if (!fullSha(commit) || commit === head || url !== prefix + commit + suffix)
    throw new Error("Owner review requires immutable same-repository source URL");
  return { commit, path };
}
function parseOwnerReviewFile(bytes, expected) {
  if (expected && hash(bytes) !== expected.sha256)
    throw new Error("Owner review immutable file digest mismatch");
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new Error("Owner review file is not valid JSON");
  }
}

// review-source:ci/quality/receipt-validation-gate.ts
var record = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
function snapshotOwnerPolicy(input) {
  const publisher = Object.freeze({
    id: input.publisher.id,
    login: input.publisher.login,
    type: input.publisher.type
  });
  const policy = Object.freeze({
    repository: input.repository,
    projectId: input.projectId,
    domainId: input.domainId,
    semanticOwner: input.semanticOwner,
    scope: input.scope,
    statusContext: input.statusContext,
    publisher
  });
  validateOwnerReviewPolicy(policy);
  return policy;
}
function snapshotOwnerReader(reader) {
  return Object.freeze({
    readCommit: reader.readCommit.bind(reader),
    readStatuses: reader.readStatuses.bind(reader),
    readTree: reader.readTree.bind(reader),
    readFile: reader.readFile.bind(reader)
  });
}
async function validateOwnerScopedReviewWithEvidence(policy, request, reader) {
  policy = snapshotOwnerPolicy(policy);
  reader = snapshotOwnerReader(reader);
  const { repository, head } = request;
  if (repository !== policy.repository || !/^[a-f0-9]{40}$/.test(head))
    throw new Error("Owner review request differs from fixed repository or exact head");
  const commit = record(await reader.readCommit(head)), tree = record(commit.tree).sha;
  if (commit.sha !== head || typeof tree !== "string" || !/^[a-f0-9]{40}$/.test(tree))
    throw new Error("Owner review source commit/tree unavailable");
  function selectStatus(statuses) {
    if (!Array.isArray(statuses) || statuses.length > 100)
      throw new Error("Owner review exact-head statuses unavailable or outside bound");
    const status = record(statuses.find((value) => record(value).context === policy.statusContext));
    const creator = record(status.creator);
    const { id, target_url: targetUrl } = status;
    const publisherId = String(creator.id), { login: publisherLogin, type: publisherType } = creator;
    if (status.state !== "success" || typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || typeof targetUrl !== "string" || typeof publisherLogin !== "string" || typeof publisherType !== "string" || publisherId !== policy.publisher.id || publisherLogin !== policy.publisher.login || publisherType !== policy.publisher.type)
      throw new Error("Owner review latest status is absent, held or from another publisher");
    return Object.freeze({ id, target_url: targetUrl, publisherId, publisherLogin, publisherType });
  }
  const status = selectStatus(await reader.readStatuses(head));
  const target = immutableOwnerReviewUrl(status.target_url, policy, head, "native-reviews");
  const receiptBytes = decodeBoundedReviewFile(await reader.readFile(target.path, target.commit), target.path, 32768);
  const unknownReceipt = parseOwnerReviewFile(receiptBytes), receiptRecord = record(unknownReceipt);
  if (receiptRecord.schema !== "owner-scoped-independent-review.v1")
    throw new Error("Owner review receipt schema mismatch");
  const manifest = deriveReviewedSourceManifest(await reader.readTree(tree), tree);
  validateOwnerReviewProof(unknownReceipt, policy, head, tree, manifest.sha256);
  const receipt = unknownReceipt;
  const provenance = record(receiptRecord.provenance);
  if (provenance.owner !== policy.semanticOwner || Object.keys(provenance).sort().join("|") !== "evidence|owner|rawNativeResult|result|verification")
    throw new Error("Owner review provenance owner or evidence inventory mismatch");
  const refs = {
    result: immutableOwnerReviewTarget(provenance.result, policy, head, "native-review-results"),
    evidence: immutableOwnerReviewTarget(provenance.evidence, policy, head, "native-review-evidence"),
    verification: immutableOwnerReviewTarget(provenance.verification, policy, head, "native-review-verifications"),
    rawNativeResult: immutableOwnerReviewTarget(provenance.rawNativeResult, policy, head, "native-review-raw")
  };
  if ([refs.result, refs.evidence, refs.verification].some((ref) => ref.commit !== refs.result.commit || ref.commit === target.commit) || refs.rawNativeResult.commit === refs.result.commit || refs.rawNativeResult.commit === target.commit)
    throw new Error("Owner review requires distinct raw, evidence and receipt commits");
  for (const [child, parent] of [
    [refs.rawNativeResult.commit, head],
    [refs.result.commit, refs.rawNativeResult.commit],
    [target.commit, refs.result.commit]
  ]) {
    const publication = record(await reader.readCommit(child));
    if (publication.sha !== child || !Array.isArray(publication.parents) || publication.parents.length !== 1 || record(publication.parents[0]).sha !== parent)
      throw new Error("Owner review publication must follow source/raw/evidence/receipt ancestry");
  }
  async function read(ref, bound = 65536) {
    return parseOwnerReviewFile(decodeBoundedReviewFile(await reader.readFile(ref.path, ref.commit), ref.path, bound), ref);
  }
  const result = record(await read(refs.result));
  if (result.schema !== "owner-scoped-independent-review-result.v1")
    throw new Error("Owner review normalized result schema mismatch");
  validateOwnerReviewProof(result, policy, head, tree, manifest.sha256, receipt);
  const custody = record(record(result).custody), publisher = record(custody.publisher);
  const rawRef = immutableOwnerReviewTarget(custody.rawNativeResult, policy, head, "native-review-raw");
  if (custody.classification !== "source-custody-native-parent-observation" || Object.keys(publisher).sort().join("|") !== "id|login|type" || publisher.id !== policy.publisher.id || publisher.login !== policy.publisher.login || publisher.type !== policy.publisher.type || rawRef.commit !== refs.rawNativeResult.commit || rawRef.sha256 !== refs.rawNativeResult.sha256)
    throw new Error("Owner review normalized custody does not bind publisher and unchanged raw output");
  const raw = record(await read(refs.rawNativeResult, 262144));
  if (raw.schema !== "owner-scoped-native-review-output.v1" || raw.reviewStatus !== "complete" || !Array.isArray(raw.findings) || raw.findings.length !== 0)
    throw new Error("Owner review raw native output is incomplete or retains current findings");
  validateOwnerReviewProof(raw, policy, head, tree, manifest.sha256, receipt);
  await Promise.resolve().then(() => init_dist());
  const evidenceResult = validateArtifact(await read(refs.evidence));
  const verificationResult = validateArtifact(await read(refs.verification));
  if (!evidenceResult.valid || evidenceResult.value.kind !== "evidence" || !verificationResult.valid || verificationResult.value.kind !== "verification")
    throw new Error("Owner review requires canonical Evidence and Verification artifacts");
  const evidence = evidenceResult.value, verification = verificationResult.value;
  if (!validateReferences([evidence, verification]).valid)
    throw new Error("Owner review canonical artifact reference closure mismatch");
  for (const artifact of [evidence, verification]) {
    if (artifact.projectId !== policy.projectId || artifact.domainId !== policy.domainId || artifact.payload.details?.semanticOwner !== policy.semanticOwner)
      throw new Error("Owner review artifact semantic ownership mismatch");
    validateOwnerReviewProof(artifact.payload.details?.review, policy, head, tree, manifest.sha256, receipt);
  }
  const rawUrl = `https://github.com/${repository}/blob/${refs.rawNativeResult.commit}/${refs.rawNativeResult.path}`;
  if (evidence.payload.method !== "native-codex-independent-source-review" || evidence.payload.sourceUrl !== rawUrl || evidence.payload.upstreamRevision !== head || evidence.payload.result.outcome !== "success" || evidence.payload.result.contentMatched !== true)
    throw new Error("Owner review evidence does not describe successful exact raw native observation");
  if (verification.payload.targetRefs.length !== 1 || verification.payload.targetRefs[0] !== evidence.id || !verification.payload.criteria.some((criterion) => criterion.id === "independent-native-source-review") || verification.payload.criteria.some((criterion) => criterion.status !== "pass" || criterion.evidenceRefs.length !== 1 || criterion.evidenceRefs[0] !== evidence.id))
    throw new Error("Owner review verification requires observed passing independent-review criterion");
  const expectedInputs = [refs.result, refs.evidence, refs.rawNativeResult];
  if (verification.payload.inputHashes.length !== expectedInputs.length || expectedInputs.some((ref) => !verification.payload.inputHashes.some((input) => input.path === ref.path && input.sha256 === ref.sha256)))
    throw new Error("Owner review verification does not hash-bind result, evidence and raw native output");
  const currentStatus = selectStatus(await reader.readStatuses(head));
  if (currentStatus.id !== status.id || currentStatus.target_url !== status.target_url || currentStatus.publisherId !== status.publisherId || currentStatus.publisherLogin !== status.publisherLogin || currentStatus.publisherType !== status.publisherType)
    throw new Error("Owner review status changed while verifying immutable evidence");
  return {
    schema: "owner-scoped-native-review-ci.v1",
    binding: receipt.binding,
    headSha: head,
    reviewedTreeSha: tree,
    receipt: {
      ...target,
      sha256: (await import("crypto")).createHash("sha256").update(receiptBytes).digest("hex")
    },
    manifest,
    publisherAuthenticated: true,
    nativeAuthenticationEstablished: false,
    nativePermissionGranted: false,
    acceptanceEstablished: false
  };
}
async function ownerScopedReviewGate(policy) {
  policy = snapshotOwnerPolicy(policy);
  const fetchReview = globalThis.fetch.bind(globalThis);
  const repository = process.env.GITHUB_REPOSITORY, head = process.env.REVIEW_HEAD_SHA;
  const token = process.env.GITHUB_TOKEN;
  if (repository !== policy.repository || !head || !/^[a-f0-9]{40}$/.test(head) || !token)
    throw new Error("Owner review requires fixed repository, exact head and authenticated API read");
  async function api(path) {
    const response = await fetchReview(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      redirect: "error"
    });
    if (!response.ok)
      throw new Error("Owner review authenticated API read failed");
    return response.json();
  }
  const result = await validateOwnerScopedReviewWithEvidence(policy, { repository, head }, {
    readCommit: (sha) => api(`git/commits/${sha}`),
    readStatuses: (sha) => api(`commits/${sha}/statuses?per_page=100`),
    readTree: (sha) => api(`git/trees/${sha}?recursive=1`),
    readFile: (path, sha) => api(`contents/${path}?ref=${sha}`)
  });
  console.log(JSON.stringify(result));
}

// consumer-entry:ci/native-review.entry.ts
var policy = Object.freeze({ repository: "park-kyungchan/math-research-module", projectId: "math-research-module", domainId: "mathematics-education", semanticOwner: "math-research-module", scope: "portable-onboarding-source-ci", statusContext: "native-independent-review", publisher: Object.freeze({ id: "241037670", login: "park-kyungchan", type: "User" }) });
async function runReviewGate() {
  await ownerScopedReviewGate(policy);
}
export {
  policy,
  runReviewGate,
  validateOwnerScopedReviewWithEvidence
};
