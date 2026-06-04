# Intent Pipeline

```
Message → Normalize → Detect → Score → [AI if conf < threshold] → Validate → Execute
```

| Stage | Log table | Service |
|-------|-----------|---------|
| Normalize | `message_logs` | `intentPipelineService.stageNormalize` |
| Detect | `detection_logs` | `stageDetect` |
| AI fallback | `ai_detection_logs` | `aiIntentParser.parseWithAI` |
| Validate | `validation_logs` | `intentValidationService.validateIntent` |
| Execute | `execution_logs` | `stageExecute` |
| Errors | `system_errors` | `pipelineLogService.logSystemError` |

Entry: `routeWhatsAppMessage` → `intentPipelineService.runPipeline`.

AI: set `AI_INTENT_ENABLED=true` when integrating (stub today).

Dashboard SQL: `docs/pipeline-dashboard-queries.sql`.

Admin: `parser stats` | `parser failures` | `parser routes` | `parser low-confidence`.
