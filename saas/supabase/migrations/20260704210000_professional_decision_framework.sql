alter table public.deal_scores
  add column if not exists evidence_grade text,
  add column if not exists decision_status text,
  add column if not exists decision_rationale text;

alter table public.deal_scores drop constraint if exists deal_scores_evidence_grade_check;
alter table public.deal_scores add constraint deal_scores_evidence_grade_check
check (evidence_grade is null or evidence_grade in ('A','B','C','D'));

alter table public.deal_scores drop constraint if exists deal_scores_decision_status_check;
alter table public.deal_scores add constraint deal_scores_decision_status_check
check (decision_status is null or decision_status in ('APPROVED','CONDITIONAL','REVIEW_REQUIRED','REJECTED'));
