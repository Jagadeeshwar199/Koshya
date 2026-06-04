-- 1. Top failed user messages
select m.raw_message, count(*) as count
from public.message_logs m
join public.detection_logs d on d.message_id = m.id
where d.success = false
group by m.raw_message order by count desc limit 50;

-- 2. Most common unknown intents
select d.detected_intent, count(*) from public.detection_logs d
where d.detected_intent in ('UNKNOWN','unknown') or d.failure_reason = 'unknown_intent'
group by d.detected_intent order by count desc;

-- 3. AI fallback frequency
select count(*) as ai_calls, count(*) filter (where success) as ai_success
from public.ai_detection_logs;

-- 4. AI success rate
select round(100.0 * count(*) filter (where success) / nullif(count(*),0), 1) as ai_success_pct
from public.ai_detection_logs;

-- 5. Validation failure rate
select round(100.0 * count(*) filter (where not validation_passed) / nullif(count(*),0), 1) as validation_fail_pct
from public.validation_logs;

-- 6. Execution failure rate
select round(100.0 * count(*) filter (where not success) / nullif(count(*),0), 1) as execution_fail_pct
from public.execution_logs;

-- 7. Average confidence score
select round(avg(confidence)::numeric, 3) as avg_confidence from public.detection_logs;

-- 8. Average processing time
select round(avg(processing_time_ms)::numeric, 1) as avg_detect_ms from public.detection_logs;
select round(avg(execution_time_ms)::numeric, 1) as avg_exec_ms from public.execution_logs;

-- 9. Daily error counts
select date_trunc('day', created_at) as day, count(*) from public.system_errors
group by 1 order by 1 desc;

-- 10. Messages that repeatedly fail
select m.raw_message, count(*) as fail_count
from public.message_logs m
join public.execution_logs e on e.message_id = m.id and e.success = false
group by m.raw_message having count(*) > 1
order by fail_count desc limit 30;
