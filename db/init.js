// Nexora Marketplace — PostgreSQL seed script:  npm run db:seed   (alias: node db/init.js)
// Ensures the schema exists, then seeds a full PC-hardware catalog, demo users
// (admin / buyer / sellers), categories, reviews, orders and coupons.
//
//   npm run db:seed            -> skip if already seeded (idempotent)
//   npm run db:seed -- --force -> wipe and reseed
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { loadEnv } = require('../middleware/security');
loadEnv();

const db = require('./database');

const slugify = (s) =>
  s.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function main() {
  // --- 0. Ensure schema exists (idempotent) ---
  await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  // --- Idempotency guard: skip if already seeded unless --force ---
  const force = process.argv.includes('--force');
  const row = await db.get('SELECT COUNT(*)::int AS c FROM users');
  if (row.c > 0 && !force) {
    console.log(`Database already seeded (${row.c} users). Re-run with --force to wipe and reseed:  npm run db:seed -- --force`);
    await db.pool.end();
    return;
  }
  if (force) {
    await db.query(
      `TRUNCATE TABLE users, categories, products, cart_items, wishlist_items,
        coupons, orders, order_items, reviews, password_resets RESTART IDENTITY CASCADE`);
    console.log('Cleared existing data (--force).');
  }

  // --- 1. Users (admin + sellers + buyers) ---
  async function user(fullName, email, pass, phone, address, city, role, store = {}, sellerStatus = 'approved') {
    const info = await db.run(
      `INSERT INTO users (full_name,email,password_hash,phone,address,city,postal_code,country,role,
         store_name,store_description,store_logo,seller_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [fullName, email, bcrypt.hashSync(pass, 10), phone, address, city, '54000', 'Pakistan',
        role, store.name || null, store.desc || null, store.logo || null, sellerStatus]);
    return info.rows[0].id;
  }

  const adminId  = await user('Nexora Admin', 'admin@nexora.com', 'admin123', '+92 300 0000000', '1 Commerce Ave', 'Karachi', 'admin');
  const techId   = await user('Zain Malik', 'seller@nexora.com', 'seller123', '+92 301 1111111', 'TechVerse Building, Gulberg III', 'Lahore', 'seller',
    { name: 'TechVerse Lahore', desc: 'Premium PC components & gaming hardware. Authorized reseller of ASUS, MSI, Gigabyte, Corsair, Samsung.', logo: null });
  const gamersId = await user('Ayesha Riaz', 'gamersden@nexora.com', 'seller123', '+92 302 2222222', 'Suite 12, Shahrah-e-Faisal', 'Karachi', 'seller',
    { name: "Gamer's Den Karachi", desc: 'Gaming PCs, peripherals and consoles. Built-to-order custom rigs.', logo: null });
  const pchubId  = await user('Bilal Ahmed', 'pchub@nexora.com', 'seller123', '+92 303 3333333', 'Blue Area, G-7', 'Islamabad', 'seller',
    { name: 'PC Hub Islamabad', desc: 'Workstations, laptops and enterprise networking gear.', logo: null }, 'pending');
  const buyerId  = await user('Ali Hassan', 'buyer@nexora.com', 'buyer123', '+92 311 4444444', 'House 42, Gulshan-e-Iqbal', 'Karachi', 'buyer');
  const fatimaId = await user('Fatima Khan', 'fatima@nexora.com', 'buyer123', '+92 312 5555555', 'Street 9, DHA Phase 5', 'Lahore', 'buyer');
  const usmanId  = await user('Usman Tariq', 'usman@nexora.com', 'buyer123', '+92 313 6666666', 'F-8/3 Street 21', 'Islamabad', 'buyer');

  // --- 2. Categories (PC hardware hierarchy) ---
  async function cat(name, parent = null, image = null) {
    const info = await db.run(
      'INSERT INTO categories (name,slug,parent_id,image) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, slugify(name), parent, image]);
    return info.rows[0].id;
  }
  const U = (id, w = 700) => `https://images.unsplash.com/${id}?w=${w}&q=80`;

  const cComponents = await cat('PC Components', null, U('photo-1518770660439-4636190af475'));
  const cComputers  = await cat('Computers',    null, U('photo-1593640408182-31c70c8268f5'));
  const cMonitors   = await cat('Monitors',     null, U('photo-1527443224154-c4a3942d3acf'));
  const cGaming     = await cat('Gaming',       null, U('photo-1591488320449-011701bb6704'));
  const cNetworking = await cat('Networking',   null, U('photo-1563770660941-20978e870e26'));
  const cAccessories= await cat('Accessories',  null, U('photo-1526738549149-8e07eca6c147'));

  const cCpu      = await cat('CPUs', cComponents);
  const cGpu      = await cat('GPUs', cComponents);
  const cMotherboard = await cat('Motherboards', cComponents);
  const cRam      = await cat('RAM', cComponents);
  const cSsd      = await cat('SSDs', cComponents);
  const cHdd      = await cat('HDDs', cComponents);
  const cPsu      = await cat('PSUs', cComponents);
  const cCase     = await cat('PC Cases', cComponents);
  const cCooler   = await cat('CPU Coolers', cComponents);
  const cFan      = await cat('Case Fans', cComponents);
  const cPaste    = await cat('Thermal Paste', cComponents);

  const cGamingPc = await cat('Gaming PCs', cComputers);
  const cDesktop  = await cat('Desktop PCs', cComputers);
  const cWorkstation = await cat('Workstations', cComputers);
  const cMiniPc   = await cat('Mini PCs', cComputers);
  const cLaptop   = await cat('Laptops', cComputers);

  const cMonGaming= await cat('Gaming Monitors', cMonitors);
  const cMon4k    = await cat('4K Monitors', cMonitors);
  const cMonPro   = await cat('Professional Monitors', cMonitors);
  const cMonHigh  = await cat('High Refresh Rate', cMonitors);

  const cKeyboard = await cat('Keyboards', cGaming);
  const cMouse    = await cat('Mice', cGaming);
  const cHeadset  = await cat('Headsets', cGaming);
  const cController = await cat('Controllers', cGaming);
  const cGamAcc   = await cat('Gaming Accessories', cGaming);

  const cRouter   = await cat('Routers', cNetworking);
  const cWifiAd   = await cat('Wi-Fi Adapters', cNetworking);
  const cLan      = await cat('LAN Cards', cNetworking);
  const cSwitch   = await cat('Switches', cNetworking);
  const cEth      = await cat('Ethernet Cables', cNetworking);

  const cPad      = await cat('Mouse Pads', cAccessories);
  const cWebcam   = await cat('Webcams', cAccessories);
  const cMic      = await cat('Microphones', cAccessories);
  const cHub      = await cat('USB Hubs', cAccessories);
  const cCables   = await cat('HDMI / DisplayPort Cables', cAccessories);
  const cCharger  = await cat('Laptop Chargers', cAccessories);
  const cCoolpad  = await cat('Cooling Pads', cAccessories);

  // --- 3. Products (real-world-style PC hardware, PKR pricing) ---
  let skuN = 1000;
  async function product(title, desc, price, discount, stock, catId, sellerId, brand, warranty, specs, tags, imgs, featured = 0, approved = 1) {
    const info = await db.run(
      `INSERT INTO products (title,slug,description,sku,price,discount_price,stock,category_id,seller_id,
         brand,warranty,specifications,tags,images,is_featured,is_approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [title, slugify(title), desc, 'NX-' + (++skuN), price, discount, stock, catId, sellerId, brand, warranty,
        JSON.stringify(specs), tags, JSON.stringify(imgs), featured, approved]);
    return info.rows[0].id;
  }
  const img = {
    cpu:   [U('photo-1591799264318-7e6ef8ddb7ea'), U('photo-1518770660439-4636190af475')],
    gpu:   [U('photo-1547082299-de196ea013d6'), U('photo-1587202372775-e229f172b9d7')],
    board: [U('photo-1518770660439-4636190af475'), U('photo-1591799264318-7e6ef8ddb7ea')],
    ram:   [U('photo-1562976540-1502c2145186'), U('photo-1592663527359-cf6642f54c7f')],
    ssd:   [U('photo-1531297484001-80022131f5a1'), U('photo-1603302576837-37561b2e2302')],
    hdd:   [U('photo-1555617981-dac3880eac6c'), U('photo-1547082299-de196ea013d6')],
    psu:   [U('photo-1587202372775-e229f172b9d7'), U('photo-1518770660439-4636190af475')],
    case:  [U('photo-1591488320449-011701bb6704'), U('photo-1587202372775-e229f172b9d7')],
    fan:   [U('photo-1587202372775-e229f172b9d7'), U('photo-1591799264318-7e6ef8ddb7ea')],
    laptop:[U('photo-1593640408182-31c70c8268f5'), U('photo-1544735716-392fe2489ffa'), U('photo-1517336714731-489689fd1ca8')],
    monitor:[U('photo-1527443224154-c4a3942d3acf'), U('photo-1585792180666-f7347c490ee2')],
    kb:    [U('photo-1587829741301-dc798b83add3'), U('photo-1618384887929-16ec33fab9ef')],
    mouse: [U('photo-1527864550417-7fd91fc51a46'), U('photo-1546435770-a3e426bf472b')],
    headset:[U('photo-1583394838336-acd977736f90'), U('photo-1505740420928-5e560c06d30e')],
    pad:   [U('photo-1526738549149-8e07eca6c147'), U('photo-1587829741301-dc798b83add3')],
    router:[U('photo-1563770660941-20978e870e26'), U('photo-1544197150-b99a580bb7a8')],
    webcam:[U('photo-1587821590397-9cd8412e36f6'), U('photo-1492707892479-7bc8d5a4ee93')],
    mic:   [U('photo-1589490812186-e4d3a901d0c8'), U('photo-1590602847861-f357a9332bbc')],
    hub:   [U('photo-1517430816045-df4b7de11d1d'), U('photo-1526738549149-8e07eca6c147')],
    misc:  [U('photo-1518770660439-4636190af475'), U('photo-1526738549149-8e07eca6c147')],
  };

  // ---- CPUs ----
  const p1 = await product('AMD Ryzen 7 7800X3D', 'The ultimate gaming CPU. 8 Zen 4 cores with 3D V-Cache deliver class-leading gaming performance while sipping just 120W TDP. AM5 socket with full DDR5 and PCIe 5.0 support. Perfect for high-FPS 1440p and 4K gaming.', 119500, 108000, 18, cCpu, techId, 'AMD', '3 Years Official Warranty',
    { cores: 8, threads: 16, base_clock: '4.2 GHz', boost_clock: '5.0 GHz', socket: 'AM5', cache: '96 MB (3D V-Cache)', tdp: '120 W' }, 'cpu,gaming,amd,am5', img.cpu, 1);
  const p2 = await product('Intel Core i7-14700K', 'Hybrid 20-core (8P + 12E) desktop processor with unlocked overclocking. Excellent for gaming, streaming and heavy productivity. Supports DDR4/DDR5 and PCIe 5.0 on the LGA 1700 platform.', 138000, null, 14, cCpu, techId, 'Intel', '3 Years Official Warranty',
    { cores: '8P + 12E (20)', threads: 28, base_clock: '3.4 GHz', boost_clock: '5.6 GHz', socket: 'LGA 1700', cache: '33 MB', tdp: '125 W' }, 'cpu,intel,lga1700,gaming', img.cpu, 0);
  const p3 = await product('AMD Ryzen 5 7600', 'Mainstream AM5 processor with 6 cores / 12 threads and a blistering 5.1 GHz boost. The perfect value pick for 1080p gaming and everyday productivity builds.', 62500, 58000, 32, cCpu, gamersId, 'AMD', '3 Years Official Warranty',
    { cores: 6, threads: 12, base_clock: '3.8 GHz', boost_clock: '5.1 GHz', socket: 'AM5', cache: '38 MB', tdp: '65 W' }, 'cpu,amd,am5,budget', img.cpu, 0);
  const p4 = await product('Intel Core i5-14600K', '14-core (6P + 8E) unlocked processor delivering outstanding gaming and creator performance. Ideal for mid-range LGA 1700 builds with DDR5 memory.', 89000, null, 12, cCpu, techId, 'Intel', '3 Years Official Warranty',
    { cores: '6P + 8E (14)', threads: 20, base_clock: '3.5 GHz', boost_clock: '5.3 GHz', socket: 'LGA 1700', cache: '24 MB', tdp: '125 W' }, 'cpu,intel,gaming', img.cpu, 0);

  // ---- GPUs ----
  const p5 = await product('NVIDIA GeForce RTX 4070 SUPER', 'Ada Lovelace graphics card with 12GB GDDR6X. DLSS 3.5, ray tracing and 56 TOPS of AI performance. Runs 1440p ultra and 4K high without breaking a sweat.', 255000, 238000, 8, cGpu, techId, 'NVIDIA', '3 Years Official Warranty',
    { vram: '12 GB GDDR6X', memory_bus: '192-bit', boost_clock: '2475 MHz', power: '220 W', ports: '3× DP 1.4a, 1× HDMI 2.1' }, 'gpu,nvidia,rtx,1440p', img.gpu, 1);
  const p6 = await product('AMD Radeon RX 7800 XT', 'RDNA 3 powerhouse with 16GB GDDR6 and 60 AI accelerators. Brilliant 1440p and entry-4K raster performance with generous VRAM for modded games and creators.', 230000, null, 10, cGpu, gamersId, 'AMD', '3 Years Official Warranty',
    { vram: '16 GB GDDR6', memory_bus: '256-bit', boost_clock: '2430 MHz', power: '263 W', ports: '2× DP 2.1, 2× HDMI 2.1' }, 'gpu,amd,rdna3,1440p', img.gpu, 0);
  const p7 = await product('NVIDIA GeForce RTX 4060', 'The best-selling 1080p ray-tracing card. 8GB GDDR6 with DLSS 3 frame generation. Compact dual-fan design fits any case.', 145000, 132000, 22, cGpu, techId, 'NVIDIA', '3 Years Official Warranty',
    { vram: '8 GB GDDR6', memory_bus: '128-bit', boost_clock: '2460 MHz', power: '115 W', ports: '3× DP 1.4a, 1× HDMI 2.1' }, 'gpu,nvidia,rtx,1080p', img.gpu, 0);
  const p8 = await product('AMD Radeon RX 7600', 'RDNA 3 graphics card with 8GB GDDR6 for silky 1080p gaming and content creation. Great value entry to modern gaming.', 118000, null, 16, cGpu, gamersId, 'AMD', '2 Years Official Warranty',
    { vram: '8 GB GDDR6', memory_bus: '128-bit', boost_clock: '2655 MHz', power: '165 W', ports: '3× DP 2.1, 1× HDMI 2.1' }, 'gpu,amd,1080p,budget', img.gpu, 0);

  // ---- Motherboards ----
  const p9 = await product('ASUS ROG STRIX B650E-F Gaming WiFi', 'Premium AM5 motherboard with PCIe 5.0, 16+2 power stages, WiFi 6E and 2.5Gb LAN. Built for 7800X3D-class CPUs with overclocking headroom.', 78000, 72000, 9, cMotherboard, techId, 'ASUS', '3 Years Official Warranty',
    { chipset: 'AMD B650E', socket: 'AM5', form_factor: 'ATX', memory: '4× DDR5, up to 128 GB', pcie: 'PCIe 5.0 x16', audio: 'ROG SupremeFX 7.1' }, 'motherboard,asus,am5,atx', img.board, 0);
  const p10 = await product('MSI MAG B760 Tomahawk WiFi DDR5', 'Intel LGA 1700 ATX board with WiFi 6E, PCIe 5.0 storage and a hardened VRM. Ideal partner for 14th-gen Core processors.', 62000, null, 13, cMotherboard, techId, 'MSI', '3 Years Official Warranty',
    { chipset: 'Intel B760', socket: 'LGA 1700', form_factor: 'ATX', memory: '4× DDR5, up to 192 GB', pcie: 'PCIe 5.0 x16', audio: 'Realtek ALC897' }, 'motherboard,msi,intel,b760', img.board, 0);
  const p11 = await product('Gigabyte B650M DS3H', 'Budget-friendly AM5 micro-ATX board. Dual M.2 slots, USB-C and a solid 8+2 phase VRM — everything you need for a value Ryzen build.', 38000, null, 26, cMotherboard, pchubId, 'Gigabyte', '3 Years Official Warranty',
    { chipset: 'AMD B650', socket: 'AM5', form_factor: 'Micro-ATX', memory: '4× DDR5, up to 128 GB', pcie: 'PCIe 4.0 x16', audio: 'Realtek ALC897' }, 'motherboard,gigabyte,am5,budget', img.board, 0);

  // ---- RAM ----
  const p12 = await product('Corsair Vengeance 32GB (2×16GB) DDR5-6000', 'High-performance DDR5 memory with tight CL30 timings, tuned for Ryzen AM5 platforms. Heat-spreader rated for XMP 3.0 and EXPO.', 42500, 39900, 30, cRam, techId, 'Corsair', 'Lifetime Limited Warranty',
    { capacity: '32 GB (2×16 GB)', memory_type: 'DDR5', speed: '6000 MT/s', latency: 'CL30', form_factor: 'DIMM', rgb: 'No' }, 'ram,dram,corsair,ddr5', img.ram, 1);
  const p13 = await product('Kingston Fury Beast 16GB DDR5-5600', 'Plug-and-play DDR5 for Intel and AMD platforms. Low-profile heatsink works in tight builds and budget motherboards.', 19000, null, 44, cRam, gamersId, 'Kingston', 'Lifetime Limited Warranty',
    { capacity: '16 GB (1×16 GB)', memory_type: 'DDR5', speed: '5600 MT/s', latency: 'CL40', form_factor: 'DIMM', rgb: 'No' }, 'ram,kingston,ddr5,budget', img.ram, 0);
  const p14 = await product('G.Skill Ripjaws V 32GB DDR4-3200', 'Classic dual-channel DDR4 for AM4 and older Intel builds. Reliable, fast and affordable upgrade path.', 15500, null, 50, cRam, pchubId, 'G.Skill', 'Lifetime Limited Warranty',
    { capacity: '32 GB (2×16 GB)', memory_type: 'DDR4', speed: '3200 MT/s', latency: 'CL16', form_factor: 'DIMM', rgb: 'No' }, 'ram,gskill,ddr4', img.ram, 0);

  // ---- SSDs ----
  const p15 = await product('Samsung 990 PRO 2TB NVMe', 'Flagship PCIe 4.0 SSD with up to 7450 MB/s reads. Superior endurance for gaming, 4K video editing and heavy workloads.', 79000, 74000, 12, cSsd, techId, 'Samsung', '5 Years Official Warranty',
    { capacity: '2 TB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '7450 MB/s', write_speed: '6900 MB/s', form_factor: 'M.2 2280', endurance: '1200 TBW' }, 'ssd,samsung,nvme,gen4', img.ssd, 1);
  const p16 = await product('WD Black SN850X 1TB', 'Gaming-grade NVMe with 7300 MB/s reads and Game Mode 2.0. DirectStorage-ready for next-gen load times.', 33500, null, 20, cSsd, gamersId, 'WD', '5 Years Official Warranty',
    { capacity: '1 TB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '7300 MB/s', write_speed: '6300 MB/s', form_factor: 'M.2 2280', endurance: '600 TBW' }, 'ssd,wd,nvme,gaming', img.ssd, 0);
  const p17 = await product('Crucial P3 Plus 1TB', 'Affordable Gen4 NVMe with 5000 MB/s reads. A superb value upgrade for gaming rigs and laptops.', 19500, null, 60, cSsd, techId, 'Crucial', '5 Years Official Warranty',
    { capacity: '1 TB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '5000 MB/s', write_speed: '4200 MB/s', form_factor: 'M.2 2280', endurance: '440 TBW' }, 'ssd,crucial,nvme,value', img.ssd, 0);
  const p18 = await product('Kingston NV2 500GB', 'Compact entry-level NVMe for OS and boot drives. Drop-in speed upgrade over any SATA drive.', 9500, 8500, 80, cSsd, gamersId, 'Kingston', '3 Years Official Warranty',
    { capacity: '500 GB', interface: 'PCIe 4.0 x4 NVMe', read_speed: '3500 MB/s', write_speed: '2100 MB/s', form_factor: 'M.2 2280', endurance: '160 TBW' }, 'ssd,kingston,nvme,budget', img.ssd, 0);

  // ---- HDDs ----
  const p19 = await product('Seagate BarraCuda 2TB 7200RPM', 'Reliable 3.5-inch storage for games, media libraries and backups. 7200RPM with 256MB cache.', 14500, null, 24, cHdd, pchubId, 'Seagate', '2 Years Official Warranty',
    { capacity: '2 TB', interface: 'SATA III', speed: '7200 RPM', cache: '256 MB', form_factor: '3.5-inch' }, 'hdd,seagate,storage', img.hdd, 0);
  const p20 = await product('WD Blue 4TB 5400RPM', 'Quiet, high-capacity bulk storage drive. Perfect for photo archives and media servers.', 27000, null, 15, cHdd, gamersId, 'WD', '2 Years Official Warranty',
    { capacity: '4 TB', interface: 'SATA III', speed: '5400 RPM', cache: '256 MB', form_factor: '3.5-inch' }, 'hdd,wd,storage', img.hdd, 0);

  // ---- PSUs ----
  const p21 = await product('MSI MAG A850GL PCIE5 850W', '80 Plus Gold ATX 3.0 power supply with native 12VHPWR connector. Quiet 120mm fan and full modular cables.', 32000, 28900, 18, cPsu, techId, 'MSI', '5 Years Official Warranty',
    { wattage: '850 W', efficiency: '80 Plus Gold', modular: 'Fully Modular', connector: 'ATX 3.0, 12VHPWR', fan: '120 mm', warranty: '5 Years' }, 'psu,msi,850w,gold', img.psu, 0);
  const p22 = await product('Corsair RM750e 750W', '80 Plus Gold fully modular PSU with low-noise operation and 105°C rated capacitors. Powers any single-GPU build comfortably.', 29000, null, 21, cPsu, techId, 'Corsair', '5 Years Official Warranty',
    { wattage: '750 W', efficiency: '80 Plus Gold', modular: 'Fully Modular', connector: 'ATX 2.52, PCIe 5.0 ready', fan: '120 mm', warranty: '5 Years' }, 'psu,corsair,750w,gold', img.psu, 0);

  // ---- Cases ----
  const p23 = await product('NZXT H5 Flow White', 'Airflow-first mid-tower with a ventilated front panel and dual-fan layout. Tempered glass side panel, excellent cable management.', 24500, null, 11, cCase, techId, 'NZXT', '2 Years Official Warranty',
    { form_factor: 'Mid-Tower ATX', fans_included: '2× 120 mm', front_panel: 'USB-C, 2× USB-A', glass: 'Tempered glass', max_gpu: '365 mm' }, 'case,nzxt,atx,airflow', img.case, 1);
  const p24 = await product('Lian Li O11 Dynamic EVO', 'The icon of showcase builds. Panoramic tempered glass, dual-chamber layout and support for 10 fans + 360mm radiators.', 36000, null, 6, cCase, gamersId, 'Lian Li', '2 Years Official Warranty',
    { form_factor: 'Mid-Tower ATX / E-ATX', fans_included: 'None', front_panel: 'USB-C, 2× USB-A', glass: 'Panoramic tempered glass', max_gpu: '420 mm' }, 'case,lianli,showcase,atx', img.case, 0);

  // ---- Coolers & fans ----
  const p25 = await product('Noctua NH-D15 Chromax', 'The benchmark air cooler. Dual-tower, dual-fan design cools 7800X3D and i7-14700K-class CPUs whisper-quiet. Lifetime fan warranty.', 29000, null, 8, cCooler, techId, 'Noctua', '6 Years Official Warranty',
    { compatibility: 'AM5, LGA 1700', type: 'Dual-tower air', fans: '2× NF-A15', height: '165 mm', noise: '24.6 dB(A)' }, 'cooler,noctua,air', img.fan, 0);
  const p26 = await product('Cooler Master Hyper 212 Black', 'The legendary budget tower cooler, now in all-black. Four heat pipes and a 120mm fan for mainstream CPUs.', 7500, null, 40, cCooler, gamersId, 'Cooler Master', '2 Years Official Warranty',
    { compatibility: 'AM5, AM4, LGA 1700', type: 'Single-tower air', fans: '1× 120 mm', height: '152 mm', noise: '27 dB(A)' }, 'cooler,cm,air,budget', img.fan, 0);
  const p27 = await product('Corsair SP120 RGB Elite (3-Pack)', 'Three 120mm PWM fans with eight individually addressable LEDs per fan. Connect via iCUE for stunning lighting loops.', 9000, 7900, 25, cFan, techId, 'Corsair', '2 Years Official Warranty',
    { size: '120 mm', type: 'PWM, RGB', airflow: '47.7 CFM', noise: '25.5 dB(A)', pack: '3 fans + controller' }, 'fan,corsair,rgb,pwm', img.fan, 0);
  const p28 = await product('Arctic MX-6 Thermal Paste 4g', 'High-performance thermal compound for CPU/GPU mounts. Extremely low thermal resistance, easy application, non-conductive.', 2500, null, 100, cPaste, techId, 'Arctic', 'No Warranty (Consumable)',
    { weight: '4 g', thermal_conductivity: '6.2 W/mK', viscosity: 'High', electrical_conductive: 'No' }, 'paste,thermal,arctic', img.misc, 0);

  // ---- Computers ----
  const p29 = await product('Nexora Apex Gaming PC (RTX 4060)', 'Pre-built 1080p beast: Ryzen 5 7600, RTX 4060, 32GB DDR5, 1TB NVMe and a 650W Gold PSU in a tempered-glass case. Tested, overclocked, ready to game.', 285000, 269000, 5, cGamingPc, gamersId, 'Nexora Custom', '1 Year Build Warranty',
    { cpu: 'AMD Ryzen 5 7600', gpu: 'RTX 4060 8GB', ram: '32 GB DDR5', storage: '1 TB NVMe', psu: '650W Gold', os: 'Windows 11 Pro' }, 'pc,gaming,prebuilt,rtx4060', img.case, 1);
  const p30 = await product('ASUS ROG Strix G16 Gaming Laptop', '16-inch 165Hz gaming laptop with Intel Core i7-13650HX, RTX 4060 and 16GB DDR5. ROG Intelligent Cooling keeps it fast under load.', 385000, 359000, 7, cLaptop, techId, 'ASUS', '1 Year International Warranty',
    { display: '16" FHD+ 165Hz', cpu: 'Intel Core i7-13650HX', gpu: 'RTX 4060 8GB', ram: '16 GB DDR5', storage: '512 GB NVMe', weight: '2.5 kg' }, 'laptop,asus,gaming,rtx', img.laptop, 1);
  const p31 = await product('Lenovo IdeaPad Slim 3', 'Everyday 15.6-inch laptop with Ryzen 5 7530U, 16GB RAM and 512GB SSD. Thin, light and great for students and office work.', 118000, null, 14, cLaptop, pchubId, 'Lenovo', '1 Year Official Warranty',
    { display: '15.6" FHD IPS', cpu: 'AMD Ryzen 5 7530U', gpu: 'Radeon Integrated', ram: '16 GB DDR4', storage: '512 GB NVMe', weight: '1.6 kg' }, 'laptop,lenovo,office,budget', img.laptop, 0);
  const p32 = await product('Dell Precision 3660 Workstation', 'Intel Core i7-13700, 32GB ECC-adjacent DDR5 and RTX A2000 for CAD, rendering and data science. Expandable tower chassis.', 520000, null, 3, cWorkstation, pchubId, 'Dell', '3 Years ProSupport',
    { cpu: 'Intel Core i7-13700', gpu: 'NVIDIA RTX A2000 12GB', ram: '32 GB DDR5', storage: '1 TB NVMe', psu: '550W Platinum', os: 'Windows 11 Pro' }, 'workstation,dell,cad,creator', img.laptop, 0);
  const p33 = await product('Beelink SER7 Mini PC', 'Pocket-sized powerhouse with Ryzen 7 7735HS, 32GB RAM and 1TB SSD. Dual 2.5GbE LAN — a fantastic home-lab or HTPC.', 92000, 86000, 9, cMiniPc, gamersId, 'Beelink', '2 Years Official Warranty',
    { cpu: 'AMD Ryzen 7 7735HS', gpu: 'Radeon 680M', ram: '32 GB DDR5', storage: '1 TB NVMe', lan: 'Dual 2.5GbE', weight: '500 g' }, 'minipc,beelink,htpc', img.misc, 0);

  // ---- Monitors ----
  const p34 = await product('LG UltraGear 27GN800 27" 144Hz', '27-inch QHD IPS gaming monitor with 144Hz and 1ms response. G-Sync compatible for tear-free esports and AAA gaming.', 62500, 57900, 16, cMonGaming, techId, 'LG', '3 Years Official Warranty',
    { size: '27"', resolution: '2560×1440', panel: 'IPS', refresh: '144 Hz', response: '1 ms', ports: '2× HDMI, 1× DP' }, 'monitor,lg,144hz,qhd', img.monitor, 1);
  const p35 = await product('Samsung Odyssey G7 32" 4K 165Hz', 'Breathtaking 4K IPS with 165Hz and HDR600. Quantum dot colour and G-Sync/FreeSync Premium Pro for the ultimate desktop experience.', 158000, null, 6, cMon4k, techId, 'Samsung', '3 Years Official Warranty',
    { size: '32"', resolution: '3840×2160', panel: 'IPS', refresh: '165 Hz', response: '1 ms', hdr: 'HDR600' }, 'monitor,samsung,4k,165hz', img.monitor, 0);
  const p36 = await product('Dell UltraSharp U2723QE 27" 4K', 'Professional 4K monitor with 98% DCI-P3, USB-C 90W PD and KVM. Colour-accurate out of the box for designers and editors.', 124000, null, 5, cMonPro, pchubId, 'Dell', '3 Years Advanced Exchange',
    { size: '27"', resolution: '3840×2160', panel: 'IPS Black', refresh: '60 Hz', color: '98% DCI-P3', ports: 'USB-C 90W, HDMI, DP' }, 'monitor,dell,4k,professional', img.monitor, 0);
  const p37 = await product('AOC 24G2SP 24" 165Hz', 'Esports favourite. 165Hz VA panel with 1ms response and adjustable stand — everything a competitive player needs on a budget.', 38500, null, 20, cMonHigh, gamersId, 'AOC', '3 Years Official Warranty',
    { size: '24"', resolution: '1920×1080', panel: 'VA', refresh: '165 Hz', response: '1 ms', ports: '2× HDMI, 1× DP' }, 'monitor,aoc,1080p,esports', img.monitor, 0);

  // ---- Gaming peripherals ----
  const p38 = await product('Razer BlackWidow V4 X', 'Tactile green-switch mechanical keyboard with per-key RGB, doubleshot keycaps and a magnetic wrist rest. Braided USB-C cable.', 31000, 27500, 24, cKeyboard, techId, 'Razer', '2 Years Official Warranty',
    { switch: 'Razer Green (Tactile)', layout: 'Full-size', rgb: 'Per-key Chroma RGB', keycaps: 'Doubleshot ABS', connectivity: 'USB-C Wired' }, 'keyboard,razer,mechanical,rgb', img.kb, 1);
  const p39 = await product('Logitech G502 X PLUS', 'Wired/wireless hybrid hero mouse with LIGHTFORCE optical-mechanical switches, HERO 25K sensor and 8 programmable buttons.', 28000, null, 30, cMouse, techId, 'Logitech', '2 Years Official Warranty',
    { sensor: 'HERO 25K', dpi: '100–25600', switches: 'LIGHTFORCE', buttons: '8 Programmable', connectivity: 'Lightspeed + USB-C', weight: '89 g' }, 'mouse,logitech,g502,gaming', img.mouse, 1);
  const p40 = await product('HyperX Cloud III', 'Award-winning comfort and rich 53mm drivers. DTS Headphone:X spatial audio, detachable noise-cancelling mic, sturdy aluminium frame.', 34500, 31900, 17, cHeadset, gamersId, 'HyperX', '2 Years Official Warranty',
    { driver: '53 mm', frequency: '10 Hz – 21 kHz', mic: 'Detachable, NC', connectivity: '3.5mm + USB', compatibility: 'PC, PS5, Xbox, Switch', weight: '320 g' }, 'headset,hyperx,gaming,audio', img.headset, 0);
  const p41 = await product('Xbox Wireless Controller (Carbon)', 'Official Xbox controller with textured grips, hybrid D-pad and Bluetooth + Xbox Wireless. Works flawlessly on PC and console.', 22000, null, 28, cController, gamersId, 'Microsoft', '1 Year Official Warranty',
    { connectivity: 'Xbox Wireless, Bluetooth, USB-C', battery: 'AA / rechargeable pack', platforms: 'PC, Xbox, Mobile', color: 'Carbon Black' }, 'controller,xbox,gaming', img.misc, 0);
  const p42 = await product('Elgato Stream Deck MK.2', '15 programmable LCD keys for streaming, editing and productivity macros. The ultimate creator sidekick.', 52000, null, 8, cGamAcc, techId, 'Elgato', '2 Years Official Warranty',
    { keys: '15 LCD keys', connectivity: 'USB-C', software: 'Stream Deck App', platforms: 'PC, Mac' }, 'streamdeck,elgato,streaming,creator', img.misc, 0);

  // ---- Networking ----
  const p43 = await product('ASUS RT-AX53U AX1800 Router', 'Wi-Fi 6 router with dual-band 1800Mbps, AiMesh support and 4 Gigabit LAN ports. Future-proof wireless for gaming and streaming.', 19500, 17500, 22, cRouter, techId, 'ASUS', '2 Years Official Warranty',
    { standard: 'Wi-Fi 6 (802.11ax)', speed: 'AX1800', bands: 'Dual-band', ports: '1× GbE WAN, 4× GbE LAN', mesh: 'AiMesh Support', security: 'AiProtection' }, 'router,asus,wifi6', img.router, 0);
  const p44 = await product('TP-Link Archer AX23', 'Budget Wi-Fi 6 router with OFDMA and MU-MIMO. Delivers faster, more reliable connections for every device at home.', 16000, null, 26, cRouter, gamersId, 'TP-Link', '2 Years Official Warranty',
    { standard: 'Wi-Fi 6 (802.11ax)', speed: 'AX1800', bands: 'Dual-band', ports: '1× GbE WAN, 4× GbE LAN', mesh: 'OneMesh Support' }, 'router,tplink,wifi6,budget', img.router, 0);
  const p45 = await product('TP-Link Archer TX20U Plus', 'USB Wi-Fi 6 adapter with external antennas for desktop and laptop. AX1800 speeds, WPA3 security, plug-and-play on Windows.', 6500, null, 35, cWifiAd, gamersId, 'TP-Link', '2 Years Official Warranty',
    { standard: 'Wi-Fi 6', speed: 'AX1800', interface: 'USB 3.0', antennas: 'External (2)', security: 'WPA3' }, 'wifi,adapter,tplink,usb', img.router, 0);
  const p46 = await product('TP-Link 8-Port Gigabit Switch (TL-SG108)', 'Unmanaged 8-port Gigabit switch for home networks and small offices. Fanless, silent, and ready to plug in.', 7500, null, 18, cSwitch, pchubId, 'TP-Link', '1 Year Official Warranty',
    { ports: '8× Gigabit', type: 'Unmanaged', fanless: 'Yes', mount: 'Desktop / Rack', features: 'IEEE 802.3x Flow Control' }, 'switch,tplink,gigabit', img.router, 0);
  const p47 = await product('CAT6 Ethernet Cable 10m', 'High-quality shielded Cat6 patch cable with RJ45 connectors. Reliable gigabit links for PC, consoles and smart TV.', 1200, null, 120, cEth, techId, 'Nexora', '1 Year Official Warranty',
    { category: 'Cat6', length: '10 m', connectors: 'RJ45', shielding: 'STP', speed: '10 Gbps' }, 'cable,ethernet,cat6', img.misc, 0);

  // ---- Accessories ----
  const p48 = await product('Razer Gigantus V2 XXL Mouse Pad', 'Extra-large cloth pad with heat-treated, low-friction surface. Anti-slip rubber base keeps it planted during intense matches.', 3500, 2900, 55, cPad, techId, 'Razer', '1 Year Official Warranty',
    { size: '940×410 mm', thickness: '3 mm', surface: 'Micro-weave cloth', base: 'Non-slip rubber' }, 'mousepad,razer,xxl', img.pad, 0);
  const p49 = await product('Logitech C920x HD Pro Webcam', 'Full HD 1080p streaming webcam with dual mics, autofocus and light correction. The default choice for streamers and remote workers.', 29000, null, 15, cWebcam, techId, 'Logitech', '1 Year Official Warranty',
    { resolution: '1080p / 30fps', lens: 'Glass, autofocus', mics: 'Dual noise-reducing', fov: '78°', mount: 'Clip + tripod' }, 'webcam,logitech,c920,streaming', img.webcam, 0);
  const p50 = await product('Blue Snowball iCE USB Microphone', 'Cardioid condenser mic with plug-and-play USB. Crisp vocals for gaming, podcasting and voice calls.', 13500, 11900, 20, cMic, gamersId, 'Blue', '1 Year Official Warranty',
    { capsule: 'Condenser', pattern: 'Cardioid', interface: 'USB', sample_rate: '44.1 kHz', mount: 'Desktop stand' }, 'mic,blue,snowball,podcast', img.mic, 0);
  const p51 = await product('Anker 7-in-1 USB-C Hub', 'USB-C hub with 4K HDMI, 100W PD pass-through, SD/TF readers and 3× USB 3.0. The complete laptop companion.', 8000, null, 45, cHub, gamersId, 'Anker', '18 Months Official Warranty',
    { ports: 'HDMI 4K, 100W PD, 3× USB-A, SD, TF', hdmi: '4K@30Hz', data: 'USB 3.0 (5 Gbps)', interface: 'USB-C' }, 'hub,anker,usbc,usb', img.hub, 0);
  const p52 = await product('4K HDMI 2.1 Cable 2m', 'Ultra High Speed HDMI 2.1 cable supporting 8K/60, 4K/144 and eARC. Braided nylon, gold-plated connectors.', 1500, null, 90, cCables, techId, 'Nexora', '1 Year Official Warranty',
    { standard: 'HDMI 2.1', length: '2 m', resolution: '8K/60, 4K/144', bandwidth: '48 Gbps', connector: 'Gold-plated' }, 'cable,hdmi,2.1', img.misc, 0);
  const p53 = await product('Dell 130W Laptop Charger', 'Original-quality 130W charger with USB-C for Dell/HP-compatible laptops. Over-voltage and short-circuit protection.', 6500, null, 25, cCharger, pchubId, 'Nexora', '1 Year Official Warranty',
    { power: '130 W', output: '20V / 6.5A USB-C', compatibility: 'USB-C laptops', safety: 'OVP, OCP, SCP' }, 'charger,laptop,usbc', img.misc, 0);
  const p54 = await product('Havit HV-F2056 Laptop Cooling Pad', 'Six-fan cooling pad with RGB lighting and two height settings. Keeps gaming laptops 10°C cooler under load.', 5500, 4900, 33, cCoolpad, gamersId, 'Havit', '1 Year Official Warranty',
    { fans: '6× 120 mm', airflow: '2400 RPM', size: 'Up to 17"', features: 'RGB, 2 height settings', usb: '1× USB passthrough' }, 'cooling,laptop,havit,rgb', img.fan, 0);

  // --- 4. Reviews (verified where buyer purchased; drives rating_avg / count) ---
  const reviews = [
    [p1, buyerId, 5, 'Monster gaming CPU', 'Went from a 5600X to this and the frame-rate jump in Warzone and CS2 is massive. Cool and efficient.', 1],
    [p1, usmanId, 5, 'Worth every rupee', '3D V-Cache is no joke. Runs cooler than my old i7 too.', 0],
    [p2, fatimaId, 4, 'Great for streaming', 'Handles gaming + OBS + Discord simultaneously without breaking a sweat.', 1],
    [p3, usmanId, 5, 'Best value CPU', 'Perfect pairing with a B650 board. Silent under a stock cooler for daily use.', 1],
    [p5, buyerId, 5, 'Silky 1440p', 'RTX 4070 Super chews through everything at 1440p ultra. DLSS is a cheat code.', 1],
    [p5, fatimaId, 4, 'Powerful but pricey', 'Amazing performance but it is pricey here in PKR. Zero regrets.', 0],
    [p7, usmanId, 4, 'Solid 1080p card', 'Great value for 1080p. Runs quiet and cool.', 1],
    [p9, buyerId, 5, 'Premium AM5 board', 'Sturdy build quality, effortless BIOS, and Wi-Fi is strong. Looks stunning too.', 1],
    [p12, fatimaId, 5, 'Flawless EXPO', 'Clicked one profile in BIOS and it ran 6000MT/s CL30 perfectly.', 1],
    [p15, buyerId, 5, 'Blazing fast SSD', 'Windows boots in seconds and game load times are basically gone.', 1],
    [p21, usmanId, 4, 'Quiet and clean', 'Fully modular makes cable management a joy. Rock solid so far.', 1],
    [p23, fatimaId, 5, 'Beautiful airflow case', 'Great thermals out of the box and the cable routing space is generous.', 1],
    [p29, buyerId, 5, 'Great pre-built', 'Arrived well packed, booted first try, and it plays everything at 1080p high.', 1],
    [p30, usmanId, 5, 'Portable gaming monster', '165Hz screen is gorgeous and the RTX 4060 keeps up in everything.', 1],
    [p34, buyerId, 4, 'Crisp and smooth', '144Hz QHD IPS is a massive upgrade over a 60Hz panel.', 1],
    [p38, fatimaId, 4, 'Satisfying clicks', 'Green switches feel fantastic. RGB is bright and the wrist rest helps.', 1],
    [p39, usmanId, 5, 'Best mouse I own', 'The hero sensor tracking is flawless and the hybrid switches are crisp.', 1],
    [p43, buyerId, 4, 'Strong Wi-Fi 6 signal', 'Covers my whole apartment and gaming latency dropped noticeably.', 1],
    [p48, fatimaId, 5, 'Huge and comfy', 'The XXL size covers my whole desk and the surface is very smooth.', 1],
  ];
  for (const r of reviews) {
    await db.run(
      'INSERT INTO reviews (product_id,user_id,rating,title,comment,verified) VALUES ($1,$2,$3,$4,$5,$6)',
      r);
  }
  await db.query(`UPDATE products SET
    rating_count = (SELECT COUNT(*)::int FROM reviews WHERE reviews.product_id = products.id),
    rating_avg   = COALESCE((SELECT ROUND(AVG(rating),2)::float8 FROM reviews WHERE reviews.product_id = products.id),0)`);

  // --- 5. Coupons ---
  const insCoupon = [
    ['NEXORA10', 'percent', 10, 10000, 1, null, 500],
    ['BUILDER20', 'percent', 20, 50000, 1, null, 200],
    ['FLAT250', 'fixed', 250, 0, 1, null, null],
  ];
  for (const c of insCoupon) {
    await db.run(
      'INSERT INTO coupons (code,type,value,min_subtotal,active,expires_at,usage_limit) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      c);
  }

  // --- 6. Sample orders (multiple statuses; drives seller dashboards + verified reviews) ---
  const placeOrder = (buyer, items, status, payment, tracking, couponCode = null) =>
    db.transaction(async (client) => {
      const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
      let discount = 0;
      if (couponCode) {
        const c = (await client.query('SELECT * FROM coupons WHERE code = $1', [couponCode])).rows[0];
        if (c && c.active) discount = c.type === 'percent'
          ? Math.round(subtotal * c.value / 100 * 100) / 100
          : Math.min(c.value, subtotal);
      }
      const shipping_fee = subtotal >= 25000 ? 0 : 350;
      const total = Math.round((subtotal - discount + shipping_fee) * 100) / 100;
      const buyerInfo = (await client.query('SELECT full_name, phone, address, city FROM users WHERE id = $1', [buyer])).rows[0];
      const ins = await client.query(
        `INSERT INTO orders (user_id,subtotal,discount,shipping_fee,total,coupon_code,status,payment_method,payment_status,tracking_number,
           shipping_name,shipping_phone,shipping_address,shipping_city,shipping_postal,shipping_country)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [buyer, subtotal, discount, shipping_fee, total, couponCode, status,
          payment, payment === 'card' ? 'paid' : 'unpaid', tracking,
          buyerInfo.full_name, buyerInfo.phone, buyerInfo.address, buyerInfo.city, '54000', 'Pakistan']);
      const oid = ins.rows[0].id;
      for (const it of items) {
        await client.query(
          'INSERT INTO order_items (order_id,product_id,seller_id,product_title,price,quantity) VALUES ($1,$2,$3,$4,$5,$6)',
          [oid, it.pid, it.seller, it.title, it.price, it.qty]);
      }
      return oid;
    });

  const P = async (pid) => {
    const r = await db.get('SELECT id,title,price,seller_id AS seller FROM products WHERE id = $1', [pid]);
    return r;
  };

  // Delivered order (buys products => verified reviews for buyer)
  await placeOrder(buyerId, [
    { pid: p1, qty: 1, ...(await P(p1)) }, { pid: p5, qty: 1, ...(await P(p5)) }, { pid: p23, qty: 1, ...(await P(p23)) },
  ], 'delivered', 'card', 'NX-2026-0001');
  // Processing order
  await placeOrder(fatimaId, [
    { pid: p2, qty: 1, ...(await P(p2)) }, { pid: p12, qty: 1, ...(await P(p12)) }, { pid: p34, qty: 1, ...(await P(p34)) },
  ], 'processing', 'cod', null);
  // Pending order
  await placeOrder(usmanId, [
    { pid: p29, qty: 1, ...(await P(p29)) }, { pid: p39, qty: 1, ...(await P(p39)) }, { pid: p47, qty: 2, ...(await P(p47)) },
  ], 'pending', 'card', null);
  // Shipped order
  await placeOrder(buyerId, [
    { pid: p15, qty: 1, ...(await P(p15)) }, { pid: p38, qty: 1, ...(await P(p38)) },
  ], 'shipped', 'cod', null, 'NEXORA10');
  // Confirmed order
  await placeOrder(fatimaId, [
    { pid: p30, qty: 1, ...(await P(p30)) }, { pid: p43, qty: 1, ...(await P(p43)) },
  ], 'confirmed', 'card', null);

  // --- Summary ---
  const c = async (t) => (await db.get(`SELECT COUNT(*)::int AS n FROM ${t}`)).n;
  console.log('Nexora Marketplace seeded successfully (PostgreSQL):');
  console.log(`  users:      ${await c('users')}  (admin@nexora.com / admin123, buyer@nexora.com / buyer123, seller@nexora.com / seller123)`);
  console.log(`  categories: ${await c('categories')}`);
  console.log(`  products:   ${await c('products')}`);
  console.log(`  reviews:    ${await c('reviews')}`);
  console.log(`  coupons:    ${await c('coupons')}`);
  console.log(`  orders:     ${await c('orders')}`);

  await db.pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
