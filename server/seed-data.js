// Initial content, written to the database on first run only.
// After that, everything is edited from the admin panel.

export const SEED_SETTINGS = {
  hotel: {
    name: 'Kilimanjaro Hotels',
    town: 'Sotik',
    location: 'Sotik, Bomet County, Kenya',
    addressNote: 'Exact street address and map pin to be added.',
    phoneDisplay: '+254 700 262 745',
    whatsapp: '254700262745',
    email: 'info@kilimanjarohotelssotik.co.ke',
    checkIn: '2:00 PM',
    checkOut: '10:00 AM',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kilimanjaro+Hotels+Sotik',
  },
  images: { hero: '/uploads/hero.jpg', about: '/uploads/lounge.jpg' },
  amenities: [
    { icon: 'wifi', title: 'Free Wi‑Fi', text: 'Fast enough for work and video calls.' },
    { icon: 'dining', title: 'Restaurant and bar', text: 'Breakfast, lunch and dinner served daily.' },
    { icon: 'parking', title: 'Secure parking', text: 'Guarded and free for guests.' },
    { icon: 'shower', title: 'Hot showers', text: 'Reliable hot water in every room.' },
    { icon: 'events', title: 'Conference space', text: 'Meetings, weddings and events.' },
    { icon: 'clock', title: '24‑hour reception', text: 'Check in any time of day.' },
  ],
  paymentMethods: ['Pay at the hotel', 'M-Pesa on arrival', 'Card on arrival'],
  comingSoon: {
    enabled: true,
    price: 2500,
    title: 'New rooms opening soon',
    text: 'A new set of rooms is almost complete. Message us to be the first to book when they open.',
  },
  gallery: [
    { src: '/uploads/hero.jpg', alt: 'Sand Room: double bed with copper cushions and cream curtains' },
    { src: '/uploads/teal.jpg', alt: 'Teal Room: double bed with teal throw and folded towel' },
    { src: '/uploads/lounge.jpg', alt: 'Sitting area with a wall-mounted TV and an armchair' },
    { src: '/uploads/sage.jpg', alt: 'Sage Room: double bed against fresh green walls' },
  ],
};

const FEATURES = ['Double bed', 'Reading lights', 'Bedside sockets', 'Free Wi‑Fi'];

export const SEED_ROOMS = [
  { name: 'Sand Room', price: 3000, max_guests: 2, image: '/uploads/sand.jpg', features: FEATURES,
    description: 'Warm cream walls, soft full-length curtains and copper cushions.' },
  { name: 'Sage Room', price: 3000, max_guests: 2, image: '/uploads/sage.jpg', features: FEATURES,
    description: 'Fresh green walls and a calm, bright feel.' },
  { name: 'Teal Room', price: 3000, max_guests: 2, image: '/uploads/teal.jpg', features: FEATURES,
    description: 'Sky-blue walls, teal bedding and tiled floors.' },
];

export const SEED_IMAGES = ['hero.jpg', 'sand.jpg', 'sage.jpg', 'teal.jpg', 'lounge.jpg'];
