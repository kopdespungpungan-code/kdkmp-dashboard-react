-- ============================================
-- KDKMP DASHBOARD - SUPABASE SCHEMA v1
-- Project: APN KDKMP PUNGPUNGAN
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
    CREATE TYPE petugas_role AS ENUM ('petugas', 'admin', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE so_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS petugas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    gondola_assigned INT[],
    role petugas_role DEFAULT 'petugas',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    satuan TEXT DEFAULT 'PCS',
    kategori TEXT,
    supplier TEXT,
    harga_beli NUMERIC(12,2),
    harga_jual NUMERIC(12,2),
    embedding VECTOR(1536),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_system (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
    stok_akhir INT DEFAULT 0,
    stok_bulan_terakhir INT DEFAULT 0,
    stok_fisik_master INT DEFAULT 0,
    total_terjual INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(produk_id)
);

CREATE TABLE IF NOT EXISTS stock_opname (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
    petugas_id UUID REFERENCES petugas(id) ON DELETE SET NULL,
    gondola INT,
    qty_fisik INT NOT NULL DEFAULT 0,
    satuan TEXT DEFAULT 'PCS',
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    minggu_ke INT,
    bulan TEXT,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gudang (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
    qty_pcs INT DEFAULT 0,
    keterangan TEXT,
    tanggal_rekap DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(produk_id)
);

CREATE TABLE IF NOT EXISTS struk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
    petugas_id UUID REFERENCES petugas(id) ON DELETE SET NULL,
    url TEXT,
    omset INT DEFAULT 0,
    gross INT DEFAULT 0,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    minggu_ke INT,
    bulan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS so_apn (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomor_so TEXT UNIQUE NOT NULL,
    tanggal DATE NOT NULL,
    customer TEXT,
    keterangan TEXT,
    total NUMERIC(12,2) DEFAULT 0,
    status so_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS so_apn_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    so_id UUID REFERENCES so_apn(id) ON DELETE CASCADE,
    produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
    qty INT NOT NULL DEFAULT 0,
    harga NUMERIC(12,2) DEFAULT 0,
    subtotal NUMERIC(12,2) DEFAULT 0
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_kode ON products(kode);
CREATE INDEX IF NOT EXISTS idx_products_nama ON products USING gin (to_tsvector('indonesian', nama));
CREATE INDEX IF NOT EXISTS idx_stock_opname_tanggal ON stock_opname(tanggal);
CREATE INDEX IF NOT EXISTS idx_stock_opname_petugas ON stock_opname(petugas_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_produk ON stock_opname(produk_id);
CREATE INDEX IF NOT EXISTS idx_struk_tanggal ON struk(tanggal);
CREATE INDEX IF NOT EXISTS idx_so_apn_tanggal ON so_apn(tanggal);
CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE petugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname ENABLE ROW LEVEL SECURITY;
ALTER TABLE struk ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_system ENABLE ROW LEVEL SECURITY;
ALTER TABLE gudang ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Petugas hanya data sendiri" ON stock_opname;
CREATE POLICY "Petugas hanya data sendiri" ON stock_opname
    FOR ALL USING (petugas_id = auth.uid());

DROP POLICY IF EXISTS "Petugas hanya struk sendiri" ON struk;
CREATE POLICY "Petugas hanya struk sendiri" ON struk
    FOR ALL USING (petugas_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access" ON stock_opname;
CREATE POLICY "Admin full access" ON stock_opname
    FOR ALL USING (
        EXISTS (SELECT 1 FROM petugas WHERE id = auth.uid() AND role IN ('admin', 'owner'))
    );

-- ============================================
-- TRIGGERS (auto updated_at)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS update_petugas_updated_at ON petugas;
CREATE TRIGGER update_petugas_updated_at BEFORE UPDATE ON petugas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_stock_system_updated_at ON stock_system;
CREATE TRIGGER update_stock_system_updated_at BEFORE UPDATE ON stock_system
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_stock_opname_updated_at ON stock_opname;
CREATE TRIGGER update_stock_opname_updated_at BEFORE UPDATE ON stock_opname
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_gudang_updated_at ON gudang;
CREATE TRIGGER update_gudang_updated_at BEFORE UPDATE ON gudang
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_struk_updated_at ON struk;
CREATE TRIGGER update_struk_updated_at BEFORE UPDATE ON struk
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_so_apn_updated_at ON so_apn;
CREATE TRIGGER update_so_apn_updated_at BEFORE UPDATE ON so_apn
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
