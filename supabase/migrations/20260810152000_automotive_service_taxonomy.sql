begin;

-- The historical `mechanic` service domain is retained as the stable storage
-- key for compatibility, but its public taxonomy is broadened into the full
-- automotive ownership lifecycle. No parallel service registry is introduced.
update public.categories
set display_label = 'Automotive Services',
    description = 'Vehicle inspection, repair, maintenance, bodywork, recovery, transport and ownership-support services.',
    aliases = array(select distinct value from unnest(coalesce(aliases, '{}'::text[]) || array['automotive','vehicle_services','car_services']) value),
    synonyms = array(select distinct value from unnest(coalesce(synonyms, '{}'::text[]) || array['automotive services','vehicle services','car services']) value),
    taxonomy_version = taxonomy_version + 1
where marketplace_kind = 'service'
  and slug = 'mechanic';

with parent as (
  select id
  from public.categories
  where marketplace_kind = 'service' and slug = 'mechanic'
), specializations(slug, label, sort_order, description, synonyms) as (
  values
    ('vehicle_diagnostics', 'Vehicle Diagnostics', 15, 'Electronic and mechanical fault diagnosis, warning-light diagnosis and vehicle health checks.', array['car diagnostics','diagnostic scan','fault finding']::text[]),
    ('vehicle_valuation', 'Vehicle Valuation', 18, 'Independent or professional assessment of a vehicle for purchase, sale, insurance or finance decisions.', array['car valuation','vehicle appraisal','car appraisal']::text[]),
    ('engine_repair', 'Engine Repair & Rebuild', 22, 'Engine fault diagnosis, repair, overhaul and rebuild work.', array['engine repair','engine rebuild','engine overhaul']::text[]),
    ('transmission_repair', 'Transmission & Gearbox', 24, 'Manual, automatic, CVT and related drivetrain transmission diagnosis and repair.', array['gearbox repair','transmission repair','automatic gearbox']::text[]),
    ('auto_electrical', 'Auto Electrical', 26, 'Vehicle electrical diagnosis and repair including starters, alternators, wiring and electronics.', array['auto electrician','car electrical','vehicle electrical']::text[]),
    ('battery_service', 'Battery & Charging', 28, 'Battery testing, replacement, charging-system diagnosis and related mobile assistance.', array['car battery','battery replacement','charging system']::text[]),
    ('brakes', 'Brakes', 30, 'Brake inspection, pads, discs, drums, hydraulics and related repair.', array['brake repair','brake pads','brake service']::text[]),
    ('suspension_steering', 'Suspension & Steering', 32, 'Suspension, shocks, steering, bushes and related chassis repair.', array['suspension repair','steering repair','shocks']::text[]),
    ('tyres_wheels', 'Tyres & Wheels', 34, 'Tyre supply, fitting, puncture repair, wheels and rim services.', array['tyres','tires','rims','puncture repair']::text[]),
    ('wheel_alignment', 'Wheel Alignment & Balancing', 36, 'Wheel alignment, balancing and related tyre geometry services.', array['alignment','wheel balancing','tracking']::text[]),
    ('air_conditioning', 'Air Conditioning', 38, 'Vehicle air-conditioning diagnosis, repair, regassing and climate-system service.', array['car aircon','ac regas','vehicle air conditioning']::text[]),
    ('panel_beating', 'Panel Beating & Dent Repair', 45, 'Collision body repair, panel beating and dent repair.', array['panel beater','dent repair','body repair']::text[]),
    ('paint_body', 'Paint & Body Refinishing', 47, 'Automotive paint, refinishing, touch-up and body restoration.', array['car paint','spray painting','body paint']::text[]),
    ('windscreen_glass', 'Windscreen & Auto Glass', 49, 'Windscreen, side-window, mirror and other vehicle-glass replacement or repair.', array['windscreen repair','auto glass','windshield']::text[]),
    ('detailing', 'Detailing', 52, 'Interior and exterior detailing, paint correction and protective finishing.', array['car detailing','valet','paint correction']::text[]),
    ('upholstery', 'Upholstery & Interior Repair', 54, 'Seats, roof lining, trim, carpets and other vehicle interior repair or retrimming.', array['car upholstery','seat repair','interior trim']::text[]),
    ('window_tinting', 'Window Tinting', 56, 'Automotive window tint installation and removal.', array['car tint','vehicle tinting']::text[]),
    ('car_wash', 'Car Wash & Cleaning', 58, 'Vehicle washing and routine interior or exterior cleaning.', array['car wash','vehicle cleaning']::text[]),
    ('vehicle_security', 'Vehicle Security & Tracking', 60, 'Alarm, immobiliser, tracker and related vehicle-security installation or service.', array['car alarm','vehicle tracker','immobiliser']::text[]),
    ('audio_infotainment', 'Audio & Infotainment', 62, 'Vehicle audio, infotainment, camera and related accessory installation.', array['car audio','android radio','reverse camera']::text[]),
    ('vehicle_towing', 'Towing', 70, 'Local vehicle towing for breakdowns, workshops and non-running vehicles.', array['car towing','tow truck','vehicle tow']::text[]),
    ('vehicle_recovery', 'Breakdown & Recovery', 72, 'Roadside recovery and recovery of stranded or disabled vehicles.', array['vehicle recovery','breakdown recovery','roadside recovery']::text[]),
    ('vehicle_transport', 'Vehicle Transport', 74, 'Transport of vehicles between cities, sellers, buyers, ports, borders or storage locations.', array['car transport','vehicle carrier','car delivery']::text[]),
    ('fleet_maintenance', 'Fleet Maintenance', 80, 'Scheduled maintenance and repair services for commercial or organisational vehicle fleets.', array['fleet service','fleet repair','fleet maintenance']::text[])
)
insert into public.categories (
  slug, canonical_slug, parent_id, marketplace_kind, display_label, description,
  sort_order, node_type, is_postable, synonyms, schema_binding, valid_from
)
select
  specializations.slug,
  specializations.slug,
  parent.id,
  'service',
  specializations.label,
  specializations.description,
  specializations.sort_order,
  'category',
  true,
  specializations.synonyms,
  jsonb_build_object(
    'schema', 'service',
    'subtype', 'mechanic',
    'defaults', jsonb_build_object(
      'service_domain', 'mechanic',
      'service_specialization', specializations.slug
    )
  ),
  now()
from parent cross join specializations
on conflict (marketplace_kind, slug) do update set
  display_label = excluded.display_label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  node_type = 'category',
  is_postable = true,
  is_active = true,
  synonyms = excluded.synonyms,
  schema_binding = excluded.schema_binding,
  valid_to = null,
  superseded_by = null,
  taxonomy_version = public.categories.taxonomy_version + 1;

-- Improve the four pre-existing automotive specializations without changing
-- their durable keys or existing service records.
update public.categories
set display_label = case slug
      when 'pre_purchase_inspection' then 'Pre-Purchase Inspection'
      when 'maintenance_repair' then 'General Maintenance & Repair'
      when 'customization_mods' then 'Customization & Modifications'
      when 'roadside_assistance' then 'Roadside Assistance'
      else display_label
    end,
    description = case slug
      when 'pre_purchase_inspection' then 'Independent vehicle checks before a purchase decision, including condition and mechanical assessment.'
      when 'maintenance_repair' then 'Routine servicing, maintenance and general mechanical repair.'
      when 'customization_mods' then 'Vehicle customization, accessories, performance work and modifications.'
      when 'roadside_assistance' then 'Mobile roadside assistance for breakdowns, minor faults and emergency support.'
      else description
    end,
    taxonomy_version = taxonomy_version + 1
where marketplace_kind = 'service'
  and slug in ('pre_purchase_inspection','maintenance_repair','customization_mods','roadside_assistance');

create index if not exists idx_services_subcategories_gin
  on public.services using gin (subcategories);

commit;
