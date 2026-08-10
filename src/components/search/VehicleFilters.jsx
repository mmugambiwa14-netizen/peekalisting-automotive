import { CAR_CATEGORIES, CAR_MAKES, CONDITIONS, FUEL_TYPES, TRANSMISSIONS } from '@/lib/constants';
import { AUTOMOTIVE_BODY_TYPES, AUTOMOTIVE_DRIVETRAINS, AUTOMOTIVE_IMPORT_STATUSES } from '@/lib/automotiveConfig';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchFilterSelect from './SearchFilterSelect';

const makes = CAR_MAKES.map((value) => ({ value, label: value }));

export default function VehicleFilters({
  category,
  categoryOptions = CAR_CATEGORIES,
  make,
  condition,
  fuelType,
  transmission,
  bodyType,
  drivetrain,
  importStatus,
  minYear,
  maxYear,
  maxMileage,
  peekOnly,
  onUpdate,
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SearchFilterSelect label="Vehicle family" value={category} onChange={(value) => onUpdate('category', value)} options={categoryOptions} />
      <SearchFilterSelect label="Body style" value={bodyType} onChange={(value) => onUpdate('bodyType', value)} options={AUTOMOTIVE_BODY_TYPES} />
      <SearchFilterSelect label="Make" value={make} onChange={(value) => onUpdate('make', value)} options={makes} />
      <SearchFilterSelect label="Condition" value={condition} onChange={(value) => onUpdate('condition', value)} options={CONDITIONS} />
      <SearchFilterSelect label="Fuel / power" value={fuelType} onChange={(value) => onUpdate('fuelType', value)} options={FUEL_TYPES} />
      <SearchFilterSelect label="Transmission" value={transmission} onChange={(value) => onUpdate('transmission', value)} options={TRANSMISSIONS} />
      <SearchFilterSelect label="Drivetrain" value={drivetrain} onChange={(value) => onUpdate('drivetrain', value)} options={AUTOMOTIVE_DRIVETRAINS} />
      <SearchFilterSelect label="Registration / import" value={importStatus} onChange={(value) => onUpdate('importStatus', value)} options={AUTOMOTIVE_IMPORT_STATUSES} />

      <div>
        <Label htmlFor="vehicle-min-year" className="text-sm font-medium">Year from</Label>
        <Input id="vehicle-min-year" type="number" inputMode="numeric" min="1900" max="2100" value={minYear} onChange={(event) => onUpdate('minYear', event.target.value)} placeholder="Any year" className="mt-2" />
      </div>
      <div>
        <Label htmlFor="vehicle-max-year" className="text-sm font-medium">Year to</Label>
        <Input id="vehicle-max-year" type="number" inputMode="numeric" min="1900" max="2100" value={maxYear} onChange={(event) => onUpdate('maxYear', event.target.value)} placeholder="Any year" className="mt-2" />
      </div>
      <div>
        <Label htmlFor="vehicle-max-mileage" className="text-sm font-medium">Maximum mileage</Label>
        <div className="relative mt-2"><Input id="vehicle-max-mileage" type="number" inputMode="numeric" min="0" max="3000000" value={maxMileage} onChange={(event) => onUpdate('maxMileage', event.target.value)} placeholder="Any mileage" className="pr-12" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-muted-foreground">km</span></div>
      </div>

      <label className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-secondary px-4 py-3">
        <input type="checkbox" checked={Boolean(peekOnly)} onChange={(event) => onUpdate('peekOnly', event.target.checked)} className="h-5 w-5 accent-primary" />
        <span><span className="block text-sm font-bold">Peek available</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Only show vehicles with a published current Peek.</span></span>
      </label>
    </div>
  );
}
