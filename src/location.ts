import { Native, isNative } from './native';
export async function detectLocation(): Promise<{ lat: number; lng: number }> {
  if (isNative) return Native.locate();
  return new Promise((resolve, reject) => {
    const unavailable = () =>
      reject(
        Error(
          'Could not get your location. Your saved city is unchanged. Allow location access and try again, or choose a city in Settings.',
        ),
      );
    if (!navigator.geolocation) {
      unavailable();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      unavailable,
      { timeout: 20000, maximumAge: 120000, enableHighAccuracy: false },
    );
  });
}
