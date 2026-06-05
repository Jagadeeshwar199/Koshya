-- Top AI fallback intents
select intent, count(*) as total
from public.ai_detection_logs
where used_ai = true and intent is not null
group by intent
order by total desc;

-- Recent AI fallback messages
select message, intent, entities, confidence, created_at
from public.ai_detection_logs
where used_ai = true
order by created_at desc
limit 50;

-- Count by intent with examples (app uses getAIFallbackCountByIntent + per-intent samples)
select intent, count(*) filter (where used_ai) as ai_total
from public.ai_detection_logs
group by intent
having count(*) filter (where used_ai) > 0
order by ai_total desc;
