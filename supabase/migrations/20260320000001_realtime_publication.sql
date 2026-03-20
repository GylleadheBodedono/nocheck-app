-- Enable realtime for all data tables
ALTER PUBLICATION supabase_realtime ADD TABLE
  checklists, checklist_responses, action_plans, action_plan_updates,
  stores, users, functions, sectors, checklist_templates,
  template_fields, template_sections, field_conditions,
  cross_validations, app_settings, template_visibility;
