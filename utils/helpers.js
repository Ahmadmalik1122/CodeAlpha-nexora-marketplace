// Shared utilities
const crypto = require('crypto');

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// PKR currency: rounds to the nearest rupee and formats with thousands separators.
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Human friendly PKR string, e.g. 115000 -> "Rs 115,000"
const pkr = (n) => {
  const v = Math.round(Number(n) || 0);
  return 'Rs ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
};

const parseImages = (json) => {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; }
  catch { return []; }
};

const parseSpecs = (json) => {
  try { const o = JSON.parse(json || '{}'); return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }
};

// Friendly display label for a specification key (category-agnostic).
const SPEC_LABELS = {
  cores: 'Cores', threads: 'Threads', base_clock: 'Base Clock', boost_clock: 'Boost Clock',
  socket: 'Socket', cache: 'Cache', tdp: 'TDP', vram: 'VRAM', memory_type: 'Memory Type',
  memory_bus: 'Memory Bus', power: 'Power Consumption', ports: 'Ports', capacity: 'Capacity',
  interface: 'Interface', read_speed: 'Read Speed', write_speed: 'Write Speed',
  form_factor: 'Form Factor', latency: 'Latency', speed: 'Speed', chipset: 'Chipset',
  pcie: 'PCIe', audio: 'Audio', fan: 'Fan', wattage: 'Wattage', efficiency: 'Efficiency',
  modular: 'Modular', connector: 'Connector', warranty: 'Warranty', fans_included: 'Fans Included',
  front_panel: 'Front Panel', glass: 'Glass', max_gpu: 'Max GPU Length', type: 'Type',
  noise: 'Noise', airflow: 'Airflow', compatibility: 'Compatibility', resolution: 'Resolution',
  panel: 'Panel', refresh: 'Refresh Rate', response: 'Response Time', hdr: 'HDR',
  color: 'Colour Coverage', cpu: 'Processor', gpu: 'Graphics', ram: 'Memory',
  storage: 'Storage', psu: 'Power Supply', os: 'Operating System', display: 'Display',
  weight: 'Weight', lan: 'LAN', keycaps: 'Keycaps', rgb: 'RGB', connectivity: 'Connectivity',
  switch: 'Switch', layout: 'Layout', sensor: 'Sensor', dpi: 'DPI', buttons: 'Buttons',
  driver: 'Driver', frequency: 'Frequency', mic: 'Microphone', battery: 'Battery',
  platforms: 'Platforms', colorway: 'Colour', keys: 'Keys', software: 'Software',
  standard: 'Wireless Standard', bands: 'Bands', mesh: 'Mesh Support', security: 'Security',
  antennas: 'Antennas', mount: 'Mounting', features: 'Features', usb: 'USB',
  length: 'Length', connectors: 'Connectors', shielding: 'Shielding',
  thickness: 'Thickness', surface: 'Surface', base: 'Base', capsule: 'Capsule',
  pattern: 'Polar Pattern', sample_rate: 'Sample Rate', endurance: 'Endurance',
  fans: 'Fans', pack: 'Pack', viscosity: 'Viscosity', electrical_conductive: 'Conductive',
  size: 'Size', output: 'Output', safety: 'Safety', height: 'Height', fov: 'FOV',
  thermal_conductivity: 'Thermal Conductivity', bandwidth: 'Bandwidth', speed_max: 'Max Speed',
};
const specLabel = (k) => SPEC_LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// Price actually charged (discount if present and lower).
const effectivePrice = (p) =>
  p.discount_price != null && p.discount_price < p.price ? p.discount_price : p.price;

// Wrap async route handlers so thrown errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const genToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

// Decorate a product row for API output (parsed images + specs + computed price + seller name).
function decorateProduct(p, sellerName = null) {
  if (!p) return p;
  const images = parseImages(p.images);
  return {
    ...p,
    images,
    specifications: parseSpecs(p.specifications),
    image: images[0] || 'https://placehold.co/700x700/eef2ff/2563eb?text=Nexora',
    effective_price: effectivePrice(p),
    on_sale: p.discount_price != null && p.discount_price < p.price,
    in_stock: p.stock > 0,
    seller_name: sellerName || p.seller_name || null,
  };
}

module.exports = {
  slugify, escapeHtml, money, pkr, parseImages, parseSpecs, specLabel,
  effectivePrice, asyncHandler, HttpError, genToken, decorateProduct,
};