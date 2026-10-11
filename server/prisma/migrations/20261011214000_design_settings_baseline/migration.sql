-- Non-destructive production baseline for design settings.
-- Setting already exists as a key/value table; earlier menu/design changes
-- do not require ALTER TABLE. Preserve every value edited in the admin panel.
INSERT INTO "Setting" ("key", "value") VALUES
  ('ui_font_scale', '1'),
  ('ui_radius', 'standard'),
  ('ui_motion', 'full'),
  ('ui_density', 'standard'),
  ('ui_button_shape', 'standard'),
  ('ui_card_border', 'normal'),
  ('ui_card_shadow', 'soft'),
  ('ui_input_style', 'outlined'),
  ('ui_chip_shape', 'pill'),
  ('ui_hover_effect', 'subtle')
ON CONFLICT ("key") DO NOTHING;
