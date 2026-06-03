-- 1. Top Failures
select failure_reason, count(*) as count
from public.parser_events
where success = false and failure_reason is not null
group by failure_reason
order by count desc;

-- 2. Intent Mismatches (wrong_route)
select
  split_part(failure_reason, '->', 1) as expected_intent,
  split_part(failure_reason, '->', 2) as actual_intent,
  count(*) as count
from public.parser_events
where failure_reason like 'wrong_route:%'
group by 1, 2
order by count desc;

-- 3. Top Failed Messages
select raw_message, count(*) as count
from public.parser_events
where success = false
group by raw_message
order by count desc
limit 50;

-- 4. Top Unknown Services
select extracted_entities->>'service' as service, count(*) as count
from public.parser_events
where extracted_entities->>'service' is not null
  and selected_route in ('unknown', 'clarify')
group by 1
order by count desc;

-- 5. Route Distribution
select selected_route as route, count(*) as count
from public.parser_events
group by selected_route
order by count desc;

-- 6. Multi-Intent Failures
select raw_message, detected_intents, selected_route, failure_reason, created_at
from public.parser_events
where jsonb_array_length(detected_intents) > 1
  and (success = false or failure_reason = 'multi_intent_partial')
order by created_at desc;

-- 7. Low Confidence Messages
select
  normalized_message,
  confidence_scores,
  count(*) as count
from public.parser_events
where (
  select coalesce(max((value)::numeric), 0)
  from jsonb_each_text(confidence_scores)
) < 65
group by normalized_message, confidence_scores
order by count desc;
