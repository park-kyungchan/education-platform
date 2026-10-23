// @bun
// core-source:packages/ontology/src/validation.ts
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
// core-source:packages/ontology/schemas/artifact.schema.json
var artifact_schema_default = {
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

// core-source:packages/ontology/src/schema.ts
var schema_default = artifact_schema_default;

// core-source:packages/ontology/src/json-validation.ts
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

// core-source:packages/ontology/src/validation.ts
var ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
addFormats(ajv);
var validateShape = ajv.compile(schema_default);
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
// core-source:packages/work-continuity/src/context/source.ts
import { createHash } from "crypto";
import { readFile, realpath, stat } from "fs/promises";
import { isAbsolute, relative, resolve, sep } from "path";

// ontology-release:dist/validation.js
import Ajv20202 from "ajv/dist/2020.js";
import addFormats2 from "ajv-formats";
// ontology-release:schemas/artifact.schema.json
var artifact_schema_default2 = {
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

// ontology-release:dist/schema.js
var schema_default2 = artifact_schema_default2;

// ontology-release:dist/json-validation.js
function jsonIssue2(value, path = "", parents = new WeakSet) {
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
    const issue = jsonIssue2(nested, `${path}/${key}`, parents);
    if (issue)
      return issue;
  }
  parents.delete(value);
}

// ontology-release:dist/validation.js
var ajv2 = new Ajv20202({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
addFormats2(ajv2);
var validateShape2 = ajv2.compile(schema_default2);
function validateArtifact2(value) {
  const invalidJson = jsonIssue2(value);
  if (invalidJson)
    return { valid: false, issues: [invalidJson] };
  if (!validateShape2(value)) {
    return { valid: false, issues: (validateShape2.errors ?? []).map((error) => ({ code: `schema:${error.keyword}`, path: error.instancePath, message: error.message ?? "Schema validation failed." })) };
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
// ontology-release:ontology/upper/vocabulary.json
var vocabulary_default = {
  schemaVersion: "1.0.0",
  id: "upper",
  terms: ["artifact", "project", "task", "decision", "evidence", "verification", "run", "reference", "authority", "version", "scope"],
  relations: ["parent", "supports", "authorizes", "implements", "verifies", "supersedes", "derivedFrom", "attemptOf", "accepts"],
  dependencyRule: "Upper vocabulary does not depend on domain modules."
};

// ontology-release:dist/upper.js
var upperVocabulary = Object.freeze(vocabulary_default);
// ontology-release:schemas/operational.schema.json
var operational_schema_default = {
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
// ontology-release:dist/operational-validation.js
import Ajv20203 from "ajv/dist/2020.js";
import addFormats3 from "ajv-formats";
var ajv3 = new Ajv20203({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
addFormats3(ajv3);
ajv3.addSchema(operational_schema_default);
var validator = (definition) => ajv3.compile({ $ref: `${operational_schema_default.$id}#/$defs/${definition}` });
var shape = ajv3.compile(operational_schema_default);
var objectShape = validator("ObjectRecord");
var linkShape = validator("LinkRecord");
var registryShape = validator("OntologyRegistry");
var requestShape = validator("ActionRequest");
// core-source:packages/work-continuity/src/context/source.ts
var sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
var localContextIo = {
  canonical: realpath,
  read: async (path) => {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size > 2097152)
      throw Error("Source must be a regular file of at most 2 MiB");
    return readFile(path);
  }
};
var decode = (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
function assertAbsolutePath(path) {
  if (!isAbsolute(path) || resolve(path) !== path)
    throw Error("Exact absolute source path required");
}
function insideRoot(root, path) {
  const part = relative(root, path);
  return part === "" || !part.startsWith(`..${sep}`) && part !== ".." && !isAbsolute(part);
}
async function exactPath(path, root, io) {
  assertAbsolutePath(root);
  assertAbsolutePath(path);
  if (!insideRoot(root, path) || await io.canonical(root) !== root || await io.canonical(path) !== path)
    throw Error("Source path must be canonical and owned by root");
}
async function readExact(path, root, io) {
  await exactPath(path, root, io);
  const bytes = await io.read(path);
  if (bytes.byteLength > 2097152)
    throw Error("Source exceeds 2 MiB");
  return bytes;
}
async function checkSources(pins, root, io) {
  const checks = [];
  const repair = [];
  for (const pin of pins) {
    let status = "current";
    let actualSha256;
    try {
      const bytes = await readExact(pin.path, root, io);
      actualSha256 = sha256(bytes);
      if (actualSha256 !== pin.sha256)
        status = "drifted";
      else if (pin.recordKind) {
        const checked = validateArtifact2(JSON.parse(decode(bytes)));
        if (!checked.valid || checked.value?.kind !== pin.recordKind)
          status = "invalid-record";
      }
    } catch (error) {
      status = typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT" ? "missing" : "unsafe";
    }
    checks.push({ path: pin.path, expectedSha256: pin.sha256, ...actualSha256 ? { actualSha256 } : {}, status });
  }
  for (const check of checks) {
    if (check.status === "current") {
      try {
        const bytes = await readExact(check.path, root, io);
        check.actualSha256 = sha256(bytes);
        if (check.actualSha256 !== check.expectedSha256)
          check.status = "drifted";
      } catch (error) {
        check.status = typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT" ? "missing" : "unsafe";
      }
    }
    if (check.status !== "current")
      repair.push({ path: check.path, action: check.status === "missing" ? "restore-source" : check.status === "drifted" ? "reobserve-source" : "repair-reference", reason: check.status });
  }
  return { status: repair.length ? "repair-required" : "current", checks, repair, authority: "none" };
}

// core-source:packages/work-continuity/src/context/validation.ts
function object(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw Error(`${label} must be an object`);
}
function keys(value, allowed, label) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw Error(`${label} has unsupported fields`);
}
function text(value, label, max = 12000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error(`${label} must be nonempty bounded text`);
}
function iso(value, label) {
  text(value, label, 40);
  if (!/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value)) || !value.endsWith("Z"))
    throw Error(`${label} must be a UTC timestamp`);
}
function array(value, label, max = 256) {
  if (!Array.isArray(value) || value.length > max)
    throw Error(`${label} must be a bounded array`);
}
function strings(value, label) {
  array(value, label);
  value.forEach((item) => text(item, label));
}
function oneOf(value, values, label) {
  if (!values.includes(String(value)))
    throw Error(`${label} is invalid`);
}
function pin(value, root, label) {
  object(value, label);
  text(value.path, `${label}.path`);
  assertAbsolutePath(value.path);
  if (!insideRoot(root, value.path))
    throw Error(`${label} is outside owning root`);
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256))
    throw Error(`${label}.sha256 must be a lowercase SHA-256`);
  if (value.role !== undefined)
    oneOf(value.role, ["purpose", "user-answer", "decision", "evidence", "context", "code"], `${label}.role`);
  if (value.recordKind !== undefined)
    oneOf(value.recordKind, ["project", "task", "proposal", "decision", "evidence", "verification", "run"], `${label}.recordKind`);
}
function uniqueIds(rows, label) {
  const ids = new Set;
  for (const row of rows) {
    object(row, label);
    text(row.id, `${label}.id`, 256);
    if (ids.has(row.id))
      throw Error(`${label} IDs must be unique`);
    ids.add(row.id);
  }
  return ids;
}
function validateCheckpoint(value) {
  object(value, "Checkpoint");
  keys(value, ["schema", "projectId", "workId", "root", "owner", "version", "updatedAt", "purpose", "userDecisions", "completed", "pending", "nextAction", "nativeThreads", "evidenceRefs", "sourcePins", "uncertainEffects", "uninterpretedInputs", "authority", "nativePermissionGranted"], "Checkpoint");
  if (value.schema !== "codex.continuity.checkpoint.v1" || value.authority !== "none" || value.nativePermissionGranted !== false)
    throw Error("Invalid checkpoint schema or authority");
  text(value.projectId, "projectId", 256);
  text(value.workId, "workId", 256);
  text(value.root, "root");
  assertAbsolutePath(value.root);
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1)
    throw Error("Checkpoint version must be a positive safe integer");
  iso(value.updatedAt, "updatedAt");
  object(value.owner, "owner");
  keys(value.owner, ["agentId", "threadId"], "owner");
  text(value.owner.agentId, "owner.agentId", 256);
  text(value.owner.threadId, "owner.threadId", 256);
  object(value.purpose, "purpose");
  keys(value.purpose, ["objective", "successCriteria", "inScope", "outOfScope"], "purpose");
  text(value.purpose.objective, "purpose.objective");
  for (const name of ["successCriteria", "inScope", "outOfScope"])
    strings(value.purpose[name], `purpose.${name}`);
  if (value.purpose.successCriteria.length === 0)
    throw Error("At least one success criterion required");
  array(value.sourcePins, "sourcePins", 1024);
  const sources = new Map;
  for (const entry of value.sourcePins) {
    object(entry, "sourcePin");
    keys(entry, ["path", "sha256", "role", "recordKind"], "sourcePin");
    pin(entry, value.root, "sourcePin");
    if (sources.has(entry.path))
      throw Error("One source pin per exact path required");
    sources.set(entry.path, entry);
  }
  const admitted = (entry, label) => {
    pin(entry, value.root, label);
    const source = sources.get(entry.path);
    if (!source || source.sha256 !== entry.sha256 || entry.recordKind !== undefined && entry.recordKind !== source.recordKind)
      throw Error(`${label} must reference an admitted source pin`);
  };
  array(value.userDecisions, "userDecisions");
  const decisionIds = uniqueIds(value.userDecisions, "userDecisions");
  for (const row of value.userDecisions) {
    object(row, "decision");
    keys(row, ["id", "question", "answer", "status", "source", "supersedes"], "decision");
    text(row.answer, "decision.answer");
    if (row.question !== undefined)
      text(row.question, "decision.question");
    oneOf(row.status, ["accepted", "superseded"], "decision.status");
    object(row.source, "decision.source");
    keys(row.source, ["path", "sha256", "role", "recordKind", "kind", "locator"], "decision.source");
    if (row.source.kind !== "actual-user-answer" || sources.get(String(row.source.path))?.role !== "user-answer")
      throw Error("Decision must reference an actual user answer, not generated history");
    text(row.source.locator, "decision.source.locator", 1024);
    admitted(row.source, "decision.source");
    if (row.supersedes !== undefined && (typeof row.supersedes !== "string" || !decisionIds.has(row.supersedes) || row.supersedes === row.id))
      throw Error("Decision supersedes must reference a different retained decision");
  }
  array(value.evidenceRefs, "evidenceRefs", 1024);
  for (const row of value.evidenceRefs) {
    object(row, "evidenceRef");
    keys(row, ["path", "sha256", "role", "recordKind", "kind", "recordId"], "evidenceRef");
    oneOf(row.kind, ["observation", "verification", "acceptance", "source"], "evidenceRef.kind");
    admitted(row, "evidenceRef");
    if (row.recordId !== undefined)
      text(row.recordId, "evidenceRef.recordId", 512);
    if (row.kind === "verification" && row.recordKind !== "verification")
      throw Error("Verification refs require a validated Verification record");
    if (row.kind === "acceptance" && row.recordKind !== "decision")
      throw Error("Acceptance refs require a separate Decision record");
  }
  const evidencePaths = new Set(value.evidenceRefs.map((row) => row.path));
  array(value.completed, "completed");
  const completedIds = uniqueIds(value.completed, "completed");
  for (const row of value.completed) {
    object(row, "completed");
    keys(row, ["id", "action", "completedAt", "verificationRefs", "replay"], "completed");
    text(row.action, "completed.action");
    iso(row.completedAt, "completed.completedAt");
    strings(row.verificationRefs, "completed.verificationRefs");
    if (row.replay !== "do-not-repeat" || row.verificationRefs.length === 0 || row.verificationRefs.some((ref) => !evidencePaths.has(String(ref))))
      throw Error("Completed effect requires pinned evidence and do-not-repeat");
  }
  array(value.pending, "pending");
  const pendingIds = uniqueIds(value.pending, "pending");
  for (const row of value.pending) {
    object(row, "pending");
    keys(row, ["id", "action", "dependsOn", "status"], "pending");
    text(row.action, "pending.action");
    strings(row.dependsOn, "pending.dependsOn");
    oneOf(row.status, ["ready", "blocked", "unknown"], "pending.status");
    if (completedIds.has(String(row.id)))
      throw Error("A completed effect cannot be queued for replay");
    if (row.dependsOn.some((id) => id === row.id || !pendingIds.has(String(id)) && !completedIds.has(String(id))))
      throw Error("Pending dependency must reference a retained task/effect");
  }
  const dependencies = new Map(value.pending.map((row) => {
    const task = row;
    return [task.id, task.dependsOn];
  }));
  const visiting = new Set, visited = new Set;
  const visit = (id) => {
    if (visiting.has(id))
      throw Error("Pending dependency cycle");
    if (visited.has(id))
      return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? [])
      if (dependencies.has(dependency))
        visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of dependencies.keys())
    visit(id);
  if (value.nextAction !== null) {
    object(value.nextAction, "nextAction");
    keys(value.nextAction, ["taskId", "action"], "nextAction");
    text(value.nextAction.action, "nextAction.action");
    if (typeof value.nextAction.taskId !== "string" || !pendingIds.has(value.nextAction.taskId))
      throw Error("Next action must refer to pending work");
  }
  array(value.nativeThreads, "nativeThreads");
  const threads = new Set;
  for (const row of value.nativeThreads) {
    object(row, "nativeThread");
    keys(row, ["threadId", "relation", "taskId", "status"], "nativeThread");
    text(row.threadId, "nativeThread.threadId", 256);
    if (threads.has(row.threadId))
      throw Error("Native thread links must be unique");
    threads.add(row.threadId);
    oneOf(row.relation, ["owner", "child", "predecessor"], "nativeThread.relation");
    oneOf(row.status, ["active", "complete", "interrupted", "unknown"], "nativeThread.status");
    if (row.taskId !== undefined && (typeof row.taskId !== "string" || !pendingIds.has(row.taskId) && !completedIds.has(row.taskId)))
      throw Error("Thread task link must refer to retained work");
  }
  array(value.uncertainEffects, "uncertainEffects");
  uniqueIds(value.uncertainEffects, "uncertainEffects");
  for (const row of value.uncertainEffects) {
    object(row, "uncertainEffect");
    keys(row, ["id", "action", "reason", "requiredObservation"], "uncertainEffect");
    for (const field of ["action", "reason", "requiredObservation"])
      text(row[field], `uncertainEffect.${field}`);
    if (completedIds.has(String(row.id)) || pendingIds.has(String(row.id)))
      throw Error("Uncertain effects must remain distinct from completed or queued actions");
  }
  array(value.uninterpretedInputs, "uninterpretedInputs");
  for (const row of value.uninterpretedInputs) {
    object(row, "uninterpretedInput");
    keys(row, ["path", "sha256", "role", "recordKind", "kind", "locator", "observedAt"], "uninterpretedInput");
    if (row.kind !== "pending-user-input")
      throw Error("Uninterpreted input must retain pending-user-input classification");
    admitted(row, "uninterpretedInput");
    text(row.locator, "uninterpretedInput.locator", 1024);
    iso(row.observedAt, "uninterpretedInput.observedAt");
  }
  return value;
}
function validateWorkContextRequest(value) {
  object(value, "Work request");
  keys(value, ["schema", "projectId", "workId", "root", "cwd", "checkpointPath", "checkpointSha256", "maxChars"], "Work request");
  if (value.schema !== "codex.work-context.request.v1")
    throw Error("Explicit native Codex Work schema required");
  for (const field of ["projectId", "workId", "root", "cwd", "checkpointPath"])
    text(value[field], field);
  for (const field of ["root", "cwd", "checkpointPath"])
    assertAbsolutePath(value[field]);
  if (!insideRoot(value.root, value.cwd) || !insideRoot(value.root, value.checkpointPath))
    throw Error("Foreign cwd or checkpoint outside owning root");
  if (value.checkpointSha256 !== undefined && (typeof value.checkpointSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.checkpointSha256)))
    throw Error("Checkpoint hash must be SHA-256");
  if (value.maxChars !== undefined && (!Number.isSafeInteger(value.maxChars) || Number(value.maxChars) < 1024 || Number(value.maxChars) > 24000))
    throw Error("Context maxChars must be between 1024 and 24000");
  return value;
}
export {
  checkSources,
  localContextIo,
  readExact,
  validateArtifact,
  validateCheckpoint,
  validateReferences,
  validateWorkContextRequest
};
