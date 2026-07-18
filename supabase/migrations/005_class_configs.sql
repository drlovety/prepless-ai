-- Add per-class configuration to user_settings
-- This stores lesson roadmap defaults per class (slide count, activity types, etc.)

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS class_configs JSONB DEFAULT '{
  "Business / Finance": {
    "period_length": 50,
    "target_slides": 12,
    "min_activities": 2,
    "max_activities": 3,
    "preferred_activity_types": ["case_study", "gallery_walk", "discussion"],
    "required_slide_types": ["title", "hook", "learning_objective", "journal_prompt", "activity_intro", "activity_recap", "exit_ticket", "next_day_preview"],
    "always_include": ["journal", "exit_ticket", "essential_question"],
    "rigor": "standard",
    "real_world_anchor": "Snohomish County and Everett local businesses"
  },
  "Digital Photography": {
    "period_length": 50,
    "target_slides": 12,
    "min_activities": 2,
    "max_activities": 3,
    "preferred_activity_types": ["gallery_walk", "hands_on", "peer_review"],
    "required_slide_types": ["title", "hook", "learning_objective", "definition_concept", "activity_intro", "activity_recap", "practice", "exit_ticket"],
    "always_include": ["journal", "exit_ticket"],
    "rigor": "standard",
    "real_world_anchor": "Cascade High School events, student portfolios, local photography businesses"
  },
  "Economics": {
    "period_length": 50,
    "target_slides": 14,
    "min_activities": 2,
    "max_activities": 3,
    "preferred_activity_types": ["simulation", "case_study", "debate"],
    "required_slide_types": ["title", "hook", "learning_objective", "definition_concept", "real_world_example", "comparison", "activity_intro", "activity_recap", "exit_ticket"],
    "always_include": ["journal", "exit_ticket", "essential_question"],
    "rigor": "rigorous",
    "real_world_anchor": "Washington state economic data, Snohomish County businesses, national policy"
  },
  "Student Store": {
    "period_length": 50,
    "target_slides": 10,
    "min_activities": 2,
    "max_activities": 3,
    "preferred_activity_types": ["hands_on", "simulation", "peer_review"],
    "required_slide_types": ["title", "hook", "learning_objective", "definition_concept", "activity_intro", "activity_recap", "practice", "exit_ticket"],
    "always_include": ["journal", "exit_ticket"],
    "rigor": "standard",
    "real_world_anchor": "The Cave student store, retail operations, inventory management"
  },
  "Independent Living": {
    "period_length": 50,
    "target_slides": 12,
    "min_activities": 2,
    "max_activities": 3,
    "preferred_activity_types": ["case_study", "discussion", "hands_on"],
    "required_slide_types": ["title", "hook", "learning_objective", "definition_concept", "real_world_example", "activity_intro", "activity_recap", "exit_ticket"],
    "always_include": ["journal", "exit_ticket"],
    "rigor": "basic",
    "real_world_anchor": "Everett rental market, WA state minimum wage, local budgeting"
  }
}'::jsonb;

COMMENT ON COLUMN user_settings.class_configs IS 'Per-class lesson generation defaults (period_length, slide counts, activity types, etc.)';
