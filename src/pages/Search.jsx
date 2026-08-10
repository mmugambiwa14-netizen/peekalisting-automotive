import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ActiveFilterChips from '@/components/search/ActiveFilterChips';
import CategoryResultsHeader from '@/components/search/CategoryResultsHeader';
import FilterSheet from '@/components/search/FilterSheet';
import ListingResults from '@/components/search/ListingResults';
import SearchToolbar from '@/components/search/SearchToolbar';
import SortSheet, { getSortLabel } from '@/components/search/SortSheet';
import { featureFlags } from '@/lib/featureFlags';
import { CONDITIONS, FUEL_TYPES, TRANSMISSIONS } from '@/lib/constants';
import { AUTOMOTIVE_BODY_TYPES, AUTOMOTIVE_DRIVETRAINS, AUTOMOTIVE_IMPORT_STATUSES, AUTOMOTIVE_SELLER_TYPES, launchVehicleCategoryOptions } from '@/lib/automotiveConfig';
import { useCurrency } from '@/lib/CurrencyContext';
import { getCurrencyConfig, getSupportedListingCurrencies, LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { getPublicSearchSuggestions, searchPublicListingsPage } from '@/services/publicListingsService';
import { getCategoryTaxonomy } from '@/services/taxonomyService';
import useDebouncedValue from '@/hooks/useDebouncedValue';

const TYPE = 'car';
const VALID_SORTS = new Set(['newest', 'price_asc', 'price_desc']);
const PRICE_SORTS = new Set(['price_asc', 'price_desc']);
const VALID_VIEWS = new Set(['list', 'map']);
const VALID_SELLER_TYPES = new Set(AUTOMOTIVE_SELLER_TYPES.map((item) => item.value));
const VALID_PRICE_CURRENCIES = new Set(getSupportedListingCurrencies(LAUNCH_COUNTRY_CODE).map((currency) => currency.code));
const RECENT_SEARCHES_KEY = 'peekalisting.automotive-recent-searches';

function readOptionalNumber(value) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readOptionalInteger(value, min, max) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function readRecentSearches() {
  try {
    const parsed = readStoredJson('local', RECENT_SEARCHES_KEY, []);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 5) : [];
  } catch { return []; }
}

function optionLabel(options, value) {
  return options.find((option) => String(option.value) === String(value))?.label || value;
}

function priceFilterLabel(minimum, maximum, currency, formatNative) {
  if (!currency) return '';
  if (minimum !== null && maximum !== null) return `${formatNative(minimum, currency)} – ${formatNative(maximum, currency)}`;
  if (minimum !== null) return `From ${formatNative(minimum, currency)}`;
  if (maximum !== null) return `Up to ${formatNative(maximum, currency)}`;
  return '';
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);
  const { formatNative } = useCurrency();

  const query = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(query);
  const requestedCurrency = String(searchParams.get('currency') || '').toUpperCase();
  const currency = VALID_PRICE_CURRENCIES.has(requestedCurrency) ? requestedCurrency : '';
  const minPrice = currency ? readOptionalNumber(searchParams.get('minPrice')) : null;
  const rawMaxPrice = currency ? readOptionalNumber(searchParams.get('maxPrice')) : null;
  const maxPrice = minPrice !== null && rawMaxPrice !== null && rawMaxPrice < minPrice ? minPrice : rawMaxPrice;
  const requestedSort = searchParams.get('sort');
  const normalizedSort = VALID_SORTS.has(requestedSort) ? requestedSort : 'newest';
  const sort = !currency && PRICE_SORTS.has(normalizedSort) ? 'newest' : normalizedSort;
  const requestedView = searchParams.get('view');
  const viewMode = featureFlags.maps && VALID_VIEWS.has(requestedView) ? requestedView : 'list';
  const category = searchParams.get('category') || '';
  const make = searchParams.get('make') || '';
  const model = (searchParams.get('model') || '').slice(0, 80);
  const requestedSellerType = (searchParams.get('sellerType') || '').toLowerCase();
  const sellerType = VALID_SELLER_TYPES.has(requestedSellerType) ? requestedSellerType : '';
  const condition = searchParams.get('condition') || '';
  const fuelType = searchParams.get('fuel') || '';
  const transmission = searchParams.get('transmission') || '';
  const bodyType = searchParams.get('bodyType') || '';
  const drivetrain = searchParams.get('drivetrain') || '';
  const importStatus = searchParams.get('importStatus') || '';
  const minYear = readOptionalInteger(searchParams.get('minYear'), 1886, 2100);
  const rawMaxYear = readOptionalInteger(searchParams.get('maxYear'), 1886, 2100);
  const maxYear = minYear !== null && rawMaxYear !== null && rawMaxYear < minYear ? minYear : rawMaxYear;
  const maxMileage = readOptionalInteger(searchParams.get('maxMileage'), 0, 3_000_000);
  const peekOnly = searchParams.get('peekOnly') === '1';
  const locationId = searchParams.get('location') || '';
  const locationName = searchParams.get('locationName') || '';
  const locationCountry = searchParams.get('country') || '';
  const locationProvince = searchParams.get('province') || '';

  const { data: categoryTaxonomy } = useQuery({
    queryKey: ['public-category-taxonomy', 'automotive-filters', LAUNCH_COUNTRY_CODE],
    queryFn: () => getCategoryTaxonomy(TYPE, LAUNCH_COUNTRY_CODE),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = useMemo(() => launchVehicleCategoryOptions(categoryTaxonomy || []), [categoryTaxonomy]);

  const selectedLocation = useMemo(() => locationId ? { country: locationCountry, state: locationProvince, city: locationId, cityName: locationName } : null, [locationId, locationCountry, locationProvince, locationName]);

  const filterValues = useMemo(() => ({
    category, make, model, sellerType, condition, fuelType, transmission, bodyType, drivetrain, importStatus,
    minYear: minYear ?? '', maxYear: maxYear ?? '', maxMileage: maxMileage ?? '', peekOnly,
    currency, minPrice, maxPrice,
  }), [category, make, model, sellerType, condition, fuelType, transmission, bodyType, drivetrain, importStatus, minYear, maxYear, maxMileage, peekOnly, currency, minPrice, maxPrice]);

  const updateParams = useCallback((updates, { replace = true } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('type', TYPE);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '' || value === false) next.delete(key);
        else next.set(key, value === true ? '1' : String(value));
      }
      next.delete('page');
      return next;
    }, { replace });
  }, [setSearchParams]);

  useEffect(() => setQueryInput(query), [query]);
  useEffect(() => {
    if (searchParams.get('type') === TYPE) return;
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('type', TYPE); return next; }, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const orphanedPriceState = !currency && (searchParams.has('minPrice') || searchParams.has('maxPrice') || PRICE_SORTS.has(normalizedSort));
    const invalidCurrency = Boolean(requestedCurrency && !currency);
    const invalidSellerType = Boolean(requestedSellerType && !sellerType);
    const legacyPage = searchParams.has('page');
    if (!orphanedPriceState && !invalidCurrency && !invalidSellerType && !legacyPage) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current); next.set('type', TYPE); next.delete('page');
      if (orphanedPriceState || invalidCurrency) { next.delete('minPrice'); next.delete('maxPrice'); }
      if (invalidCurrency) next.delete('currency');
      if (invalidSellerType) next.delete('sellerType');
      if ((orphanedPriceState || invalidCurrency) && PRICE_SORTS.has(next.get('sort'))) next.delete('sort');
      return next;
    }, { replace: true });
  }, [currency, normalizedSort, requestedCurrency, requestedSellerType, searchParams, sellerType, setSearchParams]);

  const suggestionQuery = useDebouncedValue(queryInput.trim().slice(0, 100), 250);
  const request = useMemo(() => ({
    kind: TYPE, countryCode: LAUNCH_COUNTRY_CODE, currency, query, category, locationId, minPrice, maxPrice,
    brand: make, model, sellerType, condition, fuelType, transmission, bodyType, drivetrain, importStatus,
    minYear, maxYear, maxMileage, peekOnly, sort,
  }), [currency, query, category, locationId, minPrice, maxPrice, make, model, sellerType, condition, fuelType, transmission, bodyType, drivetrain, importStatus, minYear, maxYear, maxMileage, peekOnly, sort]);

  const { data: suggestions } = useQuery({ queryKey: ['public-search-suggestions', TYPE, suggestionQuery], queryFn: ({ signal }) => getPublicSearchSuggestions(TYPE, suggestionQuery, { signal }), enabled: suggestionQuery.length >= 2, staleTime: 60_000 });
  const categorySuggestions = useMemo(() => suggestionQuery.length < 2 ? [] : categoryOptions.filter((item) => item.label.toLowerCase().includes(suggestionQuery.toLowerCase())).slice(0, 3), [categoryOptions, suggestionQuery]);
  const hasSuggestions = Boolean(categorySuggestions.length || suggestions?.listings?.length || suggestions?.locations?.length);

  const resultsQuery = useInfiniteQuery({ queryKey: ['public-listing-search-page', request], queryFn: ({ pageParam, signal }) => searchPublicListingsPage({ ...request, cursor: pageParam || null }, { signal }), initialPageParam: null, getNextPageParam: (lastPage) => lastPage.nextCursor || undefined, staleTime: 30_000 });
  const listings = useMemo(() => { const byId = new Map(); for (const pageResult of resultsQuery.data?.pages || []) for (const item of pageResult.items) byId.set(item.id, item); return [...byId.values()]; }, [resultsQuery.data]);

  const hasFilters = Boolean(category || locationId || make || model || sellerType || condition || fuelType || transmission || bodyType || drivetrain || importStatus || minYear !== null || maxYear !== null || maxMileage !== null || peekOnly || currency || minPrice !== null || maxPrice !== null);

  const rememberSearch = (value) => {
    const normalized = value.trim(); if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
    setRecentSearches(next); try { writeStoredJson('local', RECENT_SEARCHES_KEY, next); } catch { /* search stays functional */ }
  };
  const submitSearch = (event) => { event.preventDefault(); const normalized = queryInput.trim().slice(0, 100); rememberSearch(normalized); updateParams({ q: normalized || null }, { replace: false }); };
  const clearRecentSearches = () => { setRecentSearches([]); try { removeStoredValue('local', RECENT_SEARCHES_KEY); } catch { /* no-op */ } };

  const clearFilters = () => {
    const updates = { category: null, location: null, locationName: null, country: null, province: null, make: null, model: null, sellerType: null, condition: null, fuel: null, transmission: null, bodyType: null, drivetrain: null, importStatus: null, minYear: null, maxYear: null, maxMileage: null, peekOnly: null, currency: null, minPrice: null, maxPrice: null };
    if (PRICE_SORTS.has(sort)) updates.sort = null;
    updateParams(updates);
  };

  const updateViewMode = (value) => updateParams({ view: value === 'map' ? 'map' : null }, { replace: false });
  const updateCurrency = (value) => { const nextCurrency = value || null; const updates = { currency: nextCurrency, minPrice: null, maxPrice: null }; if (!nextCurrency && PRICE_SORTS.has(sort)) updates.sort = null; updateParams(updates); };

  const applyFilterSheet = ({ filters: nextFilters, location }) => {
    const nextCurrency = nextFilters.currency || null;
    const updates = {
      category: nextFilters.category || null, make: nextFilters.make || null, model: nextFilters.model?.trim() || null, sellerType: nextFilters.sellerType || null, condition: nextFilters.condition || null,
      fuel: nextFilters.fuelType || null, transmission: nextFilters.transmission || null, bodyType: nextFilters.bodyType || null,
      drivetrain: nextFilters.drivetrain || null, importStatus: nextFilters.importStatus || null,
      minYear: nextFilters.minYear || null, maxYear: nextFilters.maxYear || null, maxMileage: nextFilters.maxMileage || null,
      peekOnly: nextFilters.peekOnly ? 1 : null, currency: nextCurrency,
      minPrice: nextCurrency ? nextFilters.minPrice : null, maxPrice: nextCurrency ? nextFilters.maxPrice : null,
      country: location?.country || null, province: location?.state || null, location: location?.city || null, locationName: location?.cityName || null,
    };
    if (!nextCurrency && PRICE_SORTS.has(sort)) updates.sort = null;
    updateParams(updates);
  };

  const activeFilters = useMemo(() => {
    const filters = [];
    if (category) filters.push({ key: 'category', label: optionLabel(categoryOptions, category) });
    if (locationId) filters.push({ key: 'location', label: selectedLocation?.cityName || 'Location' });
    if (make) filters.push({ key: 'make', label: make });
    if (model) filters.push({ key: 'model', label: `Model: ${model}` });
    if (sellerType) filters.push({ key: 'sellerType', label: optionLabel(AUTOMOTIVE_SELLER_TYPES, sellerType) });
    if (bodyType) filters.push({ key: 'bodyType', label: optionLabel(AUTOMOTIVE_BODY_TYPES, bodyType) });
    if (condition) filters.push({ key: 'condition', label: optionLabel(CONDITIONS, condition) });
    if (fuelType) filters.push({ key: 'fuel', label: optionLabel(FUEL_TYPES, fuelType) });
    if (transmission) filters.push({ key: 'transmission', label: optionLabel(TRANSMISSIONS, transmission) });
    if (drivetrain) filters.push({ key: 'drivetrain', label: optionLabel(AUTOMOTIVE_DRIVETRAINS, drivetrain) });
    if (importStatus) filters.push({ key: 'importStatus', label: optionLabel(AUTOMOTIVE_IMPORT_STATUSES, importStatus) });
    if (minYear !== null || maxYear !== null) filters.push({ key: 'year', label: minYear !== null && maxYear !== null ? `${minYear}–${maxYear}` : minYear !== null ? `${minYear}+` : `Up to ${maxYear}` });
    if (maxMileage !== null) filters.push({ key: 'maxMileage', label: `≤ ${maxMileage.toLocaleString()} km` });
    if (peekOnly) filters.push({ key: 'peekOnly', label: 'Peek available' });
    if (currency) { const config = getCurrencyConfig(currency); filters.push({ key: 'currency', label: `${config.name} (${config.symbol})` }); const priceLabel = priceFilterLabel(minPrice, maxPrice, currency, formatNative); if (priceLabel) filters.push({ key: 'price', label: priceLabel }); }
    return filters;
  }, [category, categoryOptions, locationId, selectedLocation?.cityName, make, model, sellerType, bodyType, condition, fuelType, transmission, drivetrain, importStatus, minYear, maxYear, maxMileage, peekOnly, currency, minPrice, maxPrice, formatNative]);

  const removeFilter = (key) => {
    if (key === 'location') updateParams({ location: null, locationName: null, country: null, province: null });
    else if (key === 'price') updateParams({ minPrice: null, maxPrice: null });
    else if (key === 'currency') updateCurrency(null);
    else if (key === 'year') updateParams({ minYear: null, maxYear: null });
    else updateParams({ [key]: null });
  };

  return (
    <div className="min-h-[100dvh] bg-background md:pb-8">
      <header className="glass-bar sticky top-0 z-40 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <CategoryResultsHeader category={category} onCategorySelect={(value) => updateParams({ category: value })} />
          <SearchToolbar queryInput={queryInput} onQueryInputChange={setQueryInput} onSubmit={submitSearch} focused={searchFocused} onFocusChange={setSearchFocused} categorySuggestions={categorySuggestions} suggestions={suggestions} hasSuggestions={hasSuggestions} onSelectCategory={(item) => { setQueryInput(''); updateParams({ q: null, category: item.value }, { replace: false }); }} onSelectLocation={(item) => updateParams({ location: item.id, locationName: item.name }, { replace: false })} onSelectListing={(item) => { setQueryInput(item.title); rememberSearch(item.title); updateParams({ q: item.title }, { replace: false }); }} onOpenFilters={() => setFiltersOpen(true)} onOpenSort={() => setSortOpen(true)} hasFilters={hasFilters} filterCount={activeFilters.length} sortLabel={getSortLabel(sort, currency)} />
          <div className="mt-3"><ActiveFilterChips filters={activeFilters} onRemove={removeFilter} onClear={clearFilters} /></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {!query && recentSearches.length > 0 && <section className="mb-5 rounded-2xl border border-border bg-card p-4" aria-labelledby="recent-searches-title"><div className="flex items-center justify-between gap-3"><h2 id="recent-searches-title" className="text-xs font-semibold">Recent vehicle searches</h2><button type="button" onClick={clearRecentSearches} className="min-h-11 px-2 text-xs font-semibold text-primary hover:text-primary-hover">Clear</button></div><div className="mt-2 flex flex-wrap gap-2">{recentSearches.map((item) => <button key={item} type="button" onClick={() => { setQueryInput(item); updateParams({ q: item }, { replace: false }); }} className="min-h-11 rounded-full border border-border bg-surface-secondary px-3 text-xs text-foreground hover:border-border-strong">{item}</button>)}</div></section>}
        <ListingResults listings={listings} type={TYPE} isLoading={resultsQuery.isLoading} isFetching={resultsQuery.isFetching} isFetchingNextPage={resultsQuery.isFetchingNextPage} isError={resultsQuery.isError} hasNextPage={Boolean(resultsQuery.hasNextPage)} onRetry={() => resultsQuery.refetch()} onLoadMore={() => resultsQuery.fetchNextPage()} hasFilters={hasFilters} onClearFilters={clearFilters} mapsEnabled={featureFlags.maps} viewMode={viewMode} onViewModeChange={updateViewMode} />
      </main>

      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} type={TYPE} categoryOptions={categoryOptions} filters={filterValues} selectedLocation={selectedLocation} onApply={applyFilterSheet} />
      <SortSheet open={sortOpen} onOpenChange={setSortOpen} value={sort} currency={currency} onChange={(value) => updateParams({ sort: value === 'newest' ? null : value })} />
    </div>
  );
}
