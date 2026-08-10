export const AUTOMOTIVE_LISTING_KIND = 'car';
export const AUTOMOTIVE_LAUNCH_OFFER = 'sale';

export const AUTOMOTIVE_LAUNCH_SUBTYPES = Object.freeze(new Set(['car', 'bakkie', 'van']));

// These values intentionally mirror the canonical vehicle schema. Future
// markets can expand visibility without inventing a second taxonomy vocabulary.
export const AUTOMOTIVE_BODY_TYPES = Object.freeze([
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'bakkie', label: 'Pickup / bakkie' },
  { value: 'minibus', label: 'Minibus / kombi' },
  { value: 'panel_van', label: 'Panel van' },
  { value: 'wagon', label: 'Wagon' },
  { value: 'coupe', label: 'Coupe' },
  { value: 'convertible', label: 'Convertible' },
]);

export const AUTOMOTIVE_DRIVETRAINS = Object.freeze([
  { value: 'fwd', label: 'Front-wheel drive' },
  { value: 'rwd', label: 'Rear-wheel drive' },
  { value: 'awd', label: 'All-wheel drive' },
  { value: '4x4', label: '4x4' },
]);

export const AUTOMOTIVE_IMPORT_STATUSES = Object.freeze([
  { value: 'locally_registered', label: 'Locally registered' },
  { value: 'imported_registered', label: 'Imported, registered' },
  { value: 'imported_unregistered', label: 'Imported, not yet registered' },
]);

export const AUTOMOTIVE_SELLER_TYPES = Object.freeze([
  { value: 'dealer', label: 'Dealer' },
  { value: 'private', label: 'Private seller' },
]);

export const AUTOMOTIVE_FEATURED_MAKES = Object.freeze([
  'Toyota',
  'Honda',
  'Nissan',
  'Mazda',
  'Isuzu',
  'Ford',
  'Mercedes-Benz',
  'BMW',
]);

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Zimbabwe launch visibility is intentionally narrower than the global vehicle
 * ontology. The taxonomy remains capable of motorcycles, trucks, trailers and
 * future markets; this helper only decides what the automotive launch exposes.
 * Segment concepts such as luxury/classic are facets, not physical families.
 */
export function isLaunchVehicleTaxonomyNode(node) {
  if (!node || node.marketplaceKind !== AUTOMOTIVE_LISTING_KIND || node.nodeType !== 'category' || !node.isPostable || node.supersededBy) {
    return false;
  }
  const binding = objectValue(node.schemaBinding);
  const defaults = objectValue(binding.defaults);
  if (binding.schema !== AUTOMOTIVE_LISTING_KIND || !AUTOMOTIVE_LAUNCH_SUBTYPES.has(binding.subtype)) return false;
  if (defaults.offer_type && defaults.offer_type !== AUTOMOTIVE_LAUNCH_OFFER) return false;
  if (defaults.parts_family) return false;
  if (Array.isArray(defaults.segments) && defaults.segments.length) return false;
  return true;
}

export function launchVehicleCategoryOptions(nodes = []) {
  return nodes
    .filter(isLaunchVehicleTaxonomyNode)
    .sort((left, right) => left.pathLabels.join(' / ').localeCompare(right.pathLabels.join(' / ')) || left.sortOrder - right.sortOrder)
    .map((node) => ({
      value: node.stableSlug,
      label: node.label,
      canonicalSlug: node.canonicalSlug,
      schemaBinding: node.schemaBinding,
      pathLabels: node.pathLabels,
    }));
}
