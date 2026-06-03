-- AlterTable
ALTER TABLE "Bike" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "Poi" ADD COLUMN     "supportedBikeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RiderProfile" ADD COLUMN     "identityCardPhoto" TEXT,
ADD COLUMN     "identityNumber" TEXT,
ADD COLUMN     "licenceNumber" TEXT,
ADD COLUMN     "licencePhoto" TEXT,
ADD COLUMN     "passportPhoto" TEXT;
