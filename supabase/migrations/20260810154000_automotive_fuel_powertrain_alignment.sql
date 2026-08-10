begin;

-- The canonical vehicle schema already distinguishes CNG and plug-in hybrid
-- vehicles. Persist those same values so Zimbabwe import inventory and future
-- markets do not silently collapse valid powertrains into `other`.
alter type public.car_fuel_type add value if not exists 'cng';
alter type public.car_fuel_type add value if not exists 'plug_in_hybrid';

commit;
