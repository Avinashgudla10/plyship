'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Navigation, MapPin, Loader2, LocateFixed } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCncjupkxXNL-AwNpyMSuEdfRSOHNZf-so';

// Load Google Maps script once
let googleMapsPromise = null;
function loadGoogleMaps() {
    if (googleMapsPromise) return googleMapsPromise;
    if (typeof window !== 'undefined' && window.google?.maps?.Map) {
        return Promise.resolve(window.google);
    }

    googleMapsPromise = new Promise((resolve, reject) => {
        // Check if script already loaded
        if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
            const check = setInterval(() => {
                if (window.google?.maps?.Map) {
                    clearInterval(check);
                    resolve(window.google);
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geocoding&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const check = setInterval(() => {
                if (window.google?.maps?.Map) {
                    clearInterval(check);
                    resolve(window.google);
                }
            }, 100);
        };
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });

    return googleMapsPromise;
}

// Full-screen WhatsApp-style location picker using Google Maps
export default function LocationPicker({ onSelect, onClose }) {
    const [mapReady, setMapReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [gpsLoading, setGpsLoading] = useState(true);
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    const [selectedPos, setSelectedPos] = useState(null);
    const [selectedAddress, setSelectedAddress] = useState('');
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const autocompleteServiceRef = useRef(null);
    const placesServiceRef = useRef(null);
    const geocoderRef = useRef(null);
    const searchInputRef = useRef(null);
    const searchTimeoutRef = useRef(null);
    const currentLocMarkerRef = useRef(null);
    const currentLocCircleRef = useRef(null);

    // Initialize Google Maps
    useEffect(() => {
        let mounted = true;

        const initMap = async () => {
            try {
                const google = await loadGoogleMaps();
                if (!mounted || !mapContainerRef.current) return;

                // Default center (Hyderabad)
                const defaultCenter = { lat: 17.385, lng: 78.4867 };

                const map = new google.maps.Map(mapContainerRef.current, {
                    center: defaultCenter,
                    zoom: 15,
                    disableDefaultUI: true,
                    zoomControl: true,
                    zoomControlOptions: {
                        position: google.maps.ControlPosition.RIGHT_BOTTOM,
                    },
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: true,
                    styles: [
                        { featureType: 'poi.business', stylers: [{ visibility: 'on' }] },
                        { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                    ],
                });

                mapRef.current = map;
                geocoderRef.current = new google.maps.Geocoder();
                autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
                placesServiceRef.current = new google.maps.places.PlacesService(map);

                // Click on map to drop pin
                map.addListener('click', (e) => {
                    const lat = e.latLng.lat();
                    const lng = e.latLng.lng();
                    placeMarker({ lat, lng });
                    reverseGeocode(lat, lng);
                });

                setMapReady(true);
            } catch (err) {
                console.error('Google Maps init error:', err);
            }
        };

        initMap();
        return () => { mounted = false; };
    }, []);

    // Get current GPS location
    useEffect(() => {
        if (!navigator.geolocation) {
            setGpsLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };
                setCurrentLocation(loc);
                setGpsAccuracy(Math.round(pos.coords.accuracy));
                setGpsLoading(false);

                // Pan map to current location
                if (mapRef.current) {
                    mapRef.current.panTo(loc);
                    mapRef.current.setZoom(16);
                }

                // Add blue dot for current location
                if (mapRef.current && window.google) {
                    const google = window.google;

                    if (currentLocMarkerRef.current) currentLocMarkerRef.current.setMap(null);
                    if (currentLocCircleRef.current) currentLocCircleRef.current.setMap(null);

                    currentLocMarkerRef.current = new google.maps.Marker({
                        position: loc,
                        map: mapRef.current,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#3B82F6',
                            fillOpacity: 1,
                            strokeColor: 'white',
                            strokeWeight: 3,
                        },
                        clickable: false,
                        zIndex: 1,
                    });

                    currentLocCircleRef.current = new google.maps.Circle({
                        center: loc,
                        radius: pos.coords.accuracy,
                        fillColor: '#3B82F6',
                        fillOpacity: 0.1,
                        strokeColor: '#3B82F6',
                        strokeWeight: 1,
                        map: mapRef.current,
                        clickable: false,
                    });
                }
            },
            () => setGpsLoading(false),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [mapReady]);

    // Place marker on map
    const placeMarker = useCallback((position) => {
        if (!mapRef.current || !window.google) return;
        const google = window.google;

        if (markerRef.current) {
            markerRef.current.setPosition(position);
        } else {
            markerRef.current = new google.maps.Marker({
                position,
                map: mapRef.current,
                animation: google.maps.Animation.DROP,
                icon: {
                    path: 'M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
                    fillColor: '#22C55E',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                    scale: 1.8,
                    anchor: new google.maps.Point(12, 24),
                },
                zIndex: 10,
            });
        }
        setSelectedPos(position);
    }, []);

    // Reverse geocode lat/lng to address
    const reverseGeocode = useCallback((lat, lng) => {
        if (!geocoderRef.current) return;
        geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results[0]) {
                setSelectedAddress(results[0].formatted_address);
            } else {
                setSelectedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            }
        });
    }, []);

    // Search using Places Autocomplete
    const handleSearch = useCallback((query) => {
        if (!query.trim() || !autocompleteServiceRef.current) {
            setSearchResults([]);
            return;
        }
        setSearching(true);

        autocompleteServiceRef.current.getPlacePredictions(
            {
                input: query,
                componentRestrictions: { country: 'in' },
                types: ['establishment', 'geocode'],
            },
            (predictions, status) => {
                setSearching(false);
                if (status === 'OK' && predictions) {
                    setSearchResults(predictions.map(p => ({
                        placeId: p.place_id,
                        name: p.structured_formatting?.main_text || p.description.split(',')[0],
                        address: p.description,
                    })));
                } else {
                    setSearchResults([]);
                }
            }
        );
    }, []);

    // Debounced search
    const onSearchChange = (val) => {
        setSearchQuery(val);
        clearTimeout(searchTimeoutRef.current);
        if (val.trim()) {
            searchTimeoutRef.current = setTimeout(() => handleSearch(val), 300);
        } else {
            setSearchResults([]);
        }
    };

    // Select a search result
    const selectResult = (result) => {
        if (!placesServiceRef.current) return;

        placesServiceRef.current.getDetails(
            { placeId: result.placeId, fields: ['geometry', 'formatted_address', 'name'] },
            (place, status) => {
                if (status === 'OK' && place?.geometry?.location) {
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    mapRef.current?.panTo({ lat, lng });
                    mapRef.current?.setZoom(17);
                    placeMarker({ lat, lng });
                    setSelectedPos({ lat, lng });
                    setSelectedAddress(place.formatted_address || result.address);
                }
            }
        );

        setSearchResults([]);
        setSearchQuery('');
    };

    // Send current location
    const sendCurrentLocation = () => {
        if (!currentLocation || !geocoderRef.current) return;

        geocoderRef.current.geocode({ location: currentLocation }, (results, status) => {
            const address = (status === 'OK' && results[0])
                ? results[0].formatted_address
                : `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`;

            onSelect({
                lat: currentLocation.lat,
                lng: currentLocation.lng,
                address,
            });
        });
    };

    // Recenter to GPS
    const recenterToGPS = () => {
        if (currentLocation && mapRef.current) {
            mapRef.current.panTo(currentLocation);
            mapRef.current.setZoom(16);
        }
    };

    // Confirm selected pin
    const confirmSelected = () => {
        if (!selectedPos) return;
        onSelect({
            lat: selectedPos.lat,
            lng: selectedPos.lng,
            address: selectedAddress || `${selectedPos.lat.toFixed(5)}, ${selectedPos.lng.toFixed(5)}`,
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'white',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                paddingBottom: 12,
                paddingLeft: 16,
                paddingRight: 16,
                background: 'white',
                borderBottom: '1px solid #E5E7EB',
                zIndex: 10,
            }}>
                <motion.button
                    onClick={onClose}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: '#F3F4F6', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <X size={20} color="#374151" />
                </motion.button>
                <h2 style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#111827', textAlign: 'center' }}>
                    Meeting Location
                </h2>
                <div style={{ width: 36 }} />
            </div>

            {/* Search Bar */}
            <div style={{
                padding: '10px 16px',
                background: 'white',
                borderBottom: '1px solid #E5E7EB',
                zIndex: 10,
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#F3F4F6', borderRadius: 12, padding: '10px 14px',
                }}>
                    <Search size={18} color="#9CA3AF" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search for a place or address"
                        style={{
                            flex: 1, border: 'none', background: 'transparent',
                            fontSize: 15, color: '#111827', outline: 'none',
                        }}
                    />
                    {searching && (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Loader2 size={16} color="#9CA3AF" />
                        </motion.div>
                    )}
                    {searchQuery && (
                        <motion.button
                            onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                            whileTap={{ scale: 0.9 }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            <X size={16} color="#9CA3AF" />
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Search Results */}
            <AnimatePresence>
                {searchResults.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: 'absolute',
                            top: 'calc(env(safe-area-inset-top, 0px) + 120px)',
                            left: 0, right: 0,
                            background: 'white',
                            zIndex: 20,
                            maxHeight: '40vh',
                            overflow: 'auto',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        }}
                    >
                        {searchResults.map((result, i) => (
                            <motion.div
                                key={result.placeId || i}
                                onClick={() => selectResult(result)}
                                whileTap={{ backgroundColor: '#F3F4F6' }}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                    padding: '14px 16px',
                                    borderBottom: '1px solid #F3F4F6',
                                    cursor: 'pointer',
                                }}
                            >
                                <MapPin size={20} color="#6B7280" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                                        {result.name}
                                    </p>
                                    <p style={{
                                        fontSize: 12, color: '#6B7280',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {result.address}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Map */}
            <div style={{ flex: 1, position: 'relative' }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

                {/* GPS Recenter */}
                {currentLocation && (
                    <motion.button
                        onClick={recenterToGPS}
                        whileTap={{ scale: 0.9 }}
                        style={{
                            position: 'absolute',
                            bottom: 16, right: 16,
                            width: 44, height: 44,
                            borderRadius: 12,
                            background: 'white',
                            border: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 5,
                        }}
                    >
                        <Navigation size={20} color="#3B82F6" />
                    </motion.button>
                )}

                {/* Selected Pin Info */}
                <AnimatePresence>
                    {selectedPos && selectedAddress && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            style={{
                                position: 'absolute',
                                bottom: 16, left: 16, right: 70,
                                background: 'white',
                                borderRadius: 14,
                                padding: '12px 14px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                zIndex: 5,
                            }}
                        >
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                                📍 Selected Location
                            </p>
                            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>
                                {selectedAddress.length > 80 ? selectedAddress.substring(0, 80) + '...' : selectedAddress}
                            </p>
                            <motion.button
                                onClick={confirmSelected}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    width: '100%', marginTop: 8,
                                    padding: '10px 16px', borderRadius: 10,
                                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                    border: 'none', color: 'white',
                                    fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Confirm This Location
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Section — Current Location */}
            <div style={{
                background: 'white',
                borderTop: '1px solid #E5E7EB',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
            }}>
                {/* Send Current Location */}
                <motion.div
                    onClick={currentLocation ? sendCurrentLocation : undefined}
                    whileTap={currentLocation ? { backgroundColor: '#F0FDF4' } : {}}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px',
                        borderBottom: '1px solid #F3F4F6',
                        cursor: currentLocation ? 'pointer' : 'default',
                        opacity: currentLocation ? 1 : 0.5,
                    }}
                >
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: currentLocation ? '#DCFCE7' : '#F3F4F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        {gpsLoading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                <Loader2 size={20} color="#22C55E" />
                            </motion.div>
                        ) : (
                            <LocateFixed size={20} color={currentLocation ? '#22C55E' : '#9CA3AF'} />
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: currentLocation ? '#166534' : '#9CA3AF' }}>
                            Send your current location
                        </p>
                        <p style={{ fontSize: 12, color: '#6B7280' }}>
                            {gpsLoading
                                ? 'Getting location...'
                                : currentLocation
                                    ? `Accurate to ${gpsAccuracy}m`
                                    : 'Location not available'
                            }
                        </p>
                    </div>
                </motion.div>

                {/* Hint */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px',
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: '#EFF6FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <MapPin size={20} color="#3B82F6" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
                            Tap on the map to pin a location
                        </p>
                        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                            Or search for a place above
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
