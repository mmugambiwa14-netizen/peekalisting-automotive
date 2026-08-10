const DETAIL_FIELD_BY_KIND = {
  property: 'property_details',
  car: 'car_details',
  machinery: 'machinery_details',
};

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

function attributeValues(row) {
  const document = row?.attributes;
  if (!document || typeof document !== 'object' || Array.isArray(document)) return {};
  const values = document.values;
  return values && typeof values === 'object' && !Array.isArray(values) ? values : {};
}

/**
 * Adapts the normalized Supabase listing row to the stable UI shape consumed by
 * listing cards/details. Schema-backed attributes are projected explicitly so
 * an arbitrary JSON key can never overwrite an identity, ownership or price
 * field in the public UI model.
 */
export function mapPublicListing(row) {
  const detailField = DETAIL_FIELD_BY_KIND[row?.kind];
  if (!detailField) {
    throw new TypeError(`Cannot map listing kind: ${row?.kind ?? 'missing'}`);
  }

  const detail = one(row[detailField]) ?? {};
  const attributes = attributeValues(row);
  const location = one(row.location);
  const locationName = row.public_location_label || location?.name || '';

  return {
    ...row,
    ...detail,
    _type: row.kind,

    created_date: row.created_at,
    updated_date: row.updated_at,
    location_id: locationName,
    location_ref_id: location?.id ?? null,
    city: locationName,
    suburb: '',
    coordinates: {
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    },
    seller_email: row.contact_email ?? '',
    negotiable: row.accepts_offers,
    make: detail.brand,
    equipment_hours: detail.usage_hours,
    property_size: detail.size_sqm,

    // Safe, schema-known vehicle facts. These remain seller declarations unless
    // another evidence/verification surface explicitly says otherwise.
    body_type: row.kind === 'car' ? attributes.body_type ?? null : null,
    variant: row.kind === 'car' ? attributes.variant ?? null : null,
    drivetrain: row.kind === 'car' ? attributes.drivetrain ?? null : null,
    steering_side: row.kind === 'car' ? attributes.steering_side ?? null : null,
    engine_size_cc: row.kind === 'car' ? attributes.engine_size_cc ?? null : null,
    battery_capacity_kwh: row.kind === 'car' ? attributes.battery_capacity_kwh ?? null : null,
    exterior_colour: row.kind === 'car' ? attributes.exterior_colour ?? null : null,
    interior_colour: row.kind === 'car' ? attributes.interior_colour ?? null : null,
    service_history: row.kind === 'car' ? attributes.service_history ?? null : null,
    service_records_available: row.kind === 'car' ? attributes.service_records_available ?? null : null,
    accident_history: row.kind === 'car' ? attributes.accident_history ?? null : null,
    rebuilt_status: row.kind === 'car' ? attributes.rebuilt_status ?? null : null,
    previous_owners: row.kind === 'car' ? attributes.previous_owners ?? null : null,
    import_status: row.kind === 'car' ? attributes.import_status ?? null : null,
    registration_status: row.kind === 'car' ? attributes.registration_status ?? null : null,
    roadworthy_status: row.kind === 'car' ? attributes.roadworthy_status ?? null : null,
    finance_encumbrance: row.kind === 'car' ? attributes.finance_encumbrance ?? null : null,
    warranty: row.kind === 'car' ? attributes.warranty ?? null : null,
    spare_keys: row.kind === 'car' ? attributes.spare_keys ?? null : null,
    color: row.kind === 'car' ? attributes.exterior_colour ?? null : null,
    full_service_history: row.kind === 'car' ? attributes.service_history === 'full' : false,

    // Verification is intentionally excluded from the public listing contract.
    // It cannot be inferred from legacy or user-supplied fields.
    verified: false,
  };
}
