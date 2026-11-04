ALTER TABLE "parcels"
    ALTER COLUMN "length_mm" DROP NOT NULL,
    ALTER COLUMN "width_mm" DROP NOT NULL,
    ALTER COLUMN "height_mm" DROP NOT NULL;
