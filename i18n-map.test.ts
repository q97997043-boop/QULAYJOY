import { describe, it, expect } from 'vitest';
import { translate, LANGS } from '@/lib/i18n';
import { listingPoint, cities, cityCoords, listingSchema } from '@/lib/marketplace';

describe('i18n', () => {
  it('supports uz, ru and en', () => expect([...LANGS]).toEqual(['uz', 'ru', 'en']));
  it('translates and interpolates', () => {
    expect(translate('en', 'results.count', { n: 3 })).toBe('3 listings');
    expect(translate('ru', 'results.count', { n: 3 })).toBe('Объявлений: 3');
    expect(translate('uz', 'results.count', { n: 3 })).toBe('3 ta e’lon');
  });
});

describe('map points', () => {
  it('has coordinates for every city', () => cities.forEach(c => expect(cityCoords[c]).toBeDefined()));
  it('uses exact coordinates when set', () =>
    expect(listingPoint({ id: 'a', city: 'Toshkent', latitude: 41.31, longitude: 69.28 })).toEqual({ id: 'a', lat: 41.31, lng: 69.28, approx: false }));
  it('falls back to a stable point near the city centre', () => {
    const a = listingPoint({ id: 'x1', city: 'Samarqand', latitude: null, longitude: null });
    const b = listingPoint({ id: 'x1', city: 'Samarqand', latitude: null, longitude: null });
    expect(a).toEqual(b);
    expect(a?.approx).toBe(true);
    expect(Math.abs((a?.lat ?? 0) - cityCoords['Samarqand']![0])).toBeLessThan(0.03);
  });
  it('accepts coordinates in the listing schema', () =>
    expect(
      listingSchema.safeParse({
        title: 'Toshkentda qulay xona', description: 'Toshkent markazida ikki kishiga qulay xona.', category: 'room', city: 'Toshkent', district: '', address: '',
        price: 1, payment_period: 'monthly', available_places: 1, total_places: 1, rooms: 1, floor: null, room_number: '', available_from: null, available_to: null,
        amenities: [], house_rules: '', status: 'active', latitude: 41.3, longitude: 69.2,
      }).success,
    ).toBe(true));
});
