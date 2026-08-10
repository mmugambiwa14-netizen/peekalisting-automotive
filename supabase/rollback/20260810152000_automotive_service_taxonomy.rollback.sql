begin;

delete from public.categories
where marketplace_kind = 'service'
  and slug in (
    'vehicle_diagnostics','vehicle_valuation','engine_repair','transmission_repair','auto_electrical',
    'battery_service','brakes','suspension_steering','tyres_wheels','wheel_alignment','air_conditioning',
    'panel_beating','paint_body','windscreen_glass','detailing','upholstery','window_tinting','car_wash',
    'vehicle_security','audio_infotainment','vehicle_towing','vehicle_recovery','vehicle_transport','fleet_maintenance'
  );

update public.categories
set display_label = 'Mechanic',
    description = null,
    aliases = array_remove(array_remove(array_remove(coalesce(aliases, '{}'::text[]), 'automotive'), 'vehicle services'), 'car services'),
    taxonomy_version = taxonomy_version + 1
where marketplace_kind = 'service' and slug = 'mechanic';

update public.categories
set display_label = case slug
      when 'pre_purchase_inspection' then 'Pre-Purchase Inspections'
      when 'maintenance_repair' then 'Maintenance & Repair'
      when 'customization_mods' then 'Customization & Modifications'
      when 'roadside_assistance' then 'Roadside Assistance'
      else display_label
    end,
    description = null,
    taxonomy_version = taxonomy_version + 1
where marketplace_kind = 'service'
  and slug in ('pre_purchase_inspection','maintenance_repair','customization_mods','roadside_assistance');

drop index if exists public.idx_services_subcategories_gin;

commit;
