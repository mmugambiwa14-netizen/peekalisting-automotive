import { Car, Wrench } from 'lucide-react';
import BackButton from '@/components/layout/BackButton';
import CategoryFilterChips from '@/components/search/CategoryFilterChips';

export default function CategoryResultsHeader({ type = 'car', category, onCategorySelect }) {
  const services = type === 'service';
  const Icon = services ? Wrench : Car;
  return (
    <div>
      <div className="flex items-center gap-3">
        <BackButton className="-ml-2 shrink-0" />
        <div className="flex min-w-0 items-center gap-3">
          <span className="clay-icon h-11 w-11 shrink-0 border-primary/20 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="findit-overline">PeekaListing automotive</p>
            <h1 className="mt-0.5 truncate text-xl font-black tracking-tight sm:text-2xl">{services ? 'Automotive services' : 'Cars for sale'}</h1>
          </div>
        </div>
      </div>
      <CategoryFilterChips type={services ? 'service' : 'car'} category={category} onSelect={onCategorySelect} />
    </div>
  );
}
