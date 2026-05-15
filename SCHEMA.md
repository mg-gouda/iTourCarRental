# Data Schema

The full Prisma schema for the Car Rental backend. This document is the authoritative reference — `prisma/schema.prisma` should mirror it. When in doubt, this document wins; update the schema to match.

---

## Conventions

- **IDs**: `cuid()` strings throughout. (UUIDs are fine too; pick one and stay consistent.)
- **Timestamps**: every entity has `createdAt`, `updatedAt`, and `createdById` / `updatedById` where audit relevance applies.
- **Soft delete**: financial and operationally-important entities use `deletedAt DateTime?`. Queries default to filtering out soft-deleted rows via Prisma middleware.
- **Money**: `Decimal` for all monetary values. Never `Float`. Currency stored as a `String` (ISO 4217 code).
- **DateTime in UTC**: enforced at the application layer; the DB stores `timestamptz`.
- **Indexes**: every foreign key gets an index. Multi-column indexes on common filter combinations.
- **Constraints**: enforce invariants at the DB level wherever possible — uniqueness, exclusion (booking overlap), check constraints.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Identity & Access

```prisma
enum Role {
  SUPER_ADMIN
  BRANCH_MANAGER
  STAFF
  ACCOUNTANT
  MECHANIC
  CUSTOMER
}

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  passwordHash      String
  fullName          String
  role              Role
  branchScope       String[] // branch IDs; empty for super admin
  isActive          Boolean  @default(true)
  twoFactorSecret   String?  // encrypted at app layer
  twoFactorEnabled  Boolean  @default(false)
  avatarKey         String?  // S3 key
  language          String   @default("en")  // 'en' | 'ar'
  themePreference   String?  // null = follow system styling
  notificationPrefs Json     @default("{}")
  passwordChangedAt DateTime @default(now())
  lastLoginAt       DateTime?
  lockedUntil       DateTime?
  failedLoginCount  Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  sessions             Session[]
  permissionOverrides  PermissionOverride[]
  auditLogs            AuditLog[]            @relation("AuditActor")
  savedViews           SavedView[]
  notifications        Notification[]
  bookingsCreated      Booking[]             @relation("BookingCreator")
  bookingsModified     Booking[]             @relation("BookingModifier")
  paymentsRecorded     Payment[]             @relation("PaymentRecorder")

  @@index([role])
  @@index([deletedAt])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cookieHash   String   @unique
  device       String?
  ip           String?
  userAgent    String?
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())
  lastActiveAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model PermissionOverride {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  key       String   // e.g. 'bookings.cancel' or 'bookings.view.cost_breakdown'
  effect    String   // 'grant' | 'revoke'
  createdAt DateTime @default(now())
  createdById String

  @@unique([userId, key])
  @@index([userId])
}

model RolePermission {
  id        String   @id @default(cuid())
  role      Role
  key       String
  granted   Boolean  @default(true)
  updatedAt DateTime @updatedAt
  updatedById String

  @@unique([role, key])
  @@index([role])
}
```

---

## Organization

```prisma
model Branch {
  id              String   @id @default(cuid())
  name            String
  code            String   @unique             // e.g. "CAI", "HRG"
  address         String
  city            String
  country         String
  timezone        String                       // IANA tz
  defaultCurrency String                       // ISO 4217
  taxId           String?
  taxRate         Decimal  @db.Decimal(6, 4)   // e.g. 0.1400
  taxInclusive    Boolean  @default(false)
  businessHours   Json                         // weekday → open/close windows
  holidays        Json                         // date list
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  cars              Car[]            @relation("CarHomeBranch")
  pickupBookings    Booking[]        @relation("BookingPickupBranch")
  returnBookings    Booking[]        @relation("BookingReturnBranch")
  ratePlans         RatePlan[]
  cancellationPolicy CancellationPolicy?

  @@index([country])
  @@index([deletedAt])
}
```

---

## Fleet

```prisma
enum CarStatus {
  AVAILABLE
  RENTED
  IN_MAINTENANCE
  OUT_OF_SERVICE
}

enum FuelType {
  PETROL
  DIESEL
  HYBRID
  ELECTRIC
  LPG
}

enum Transmission {
  MANUAL
  AUTOMATIC
}

model CarCategory {
  id          String  @id @default(cuid())
  name        String  @unique               // "Economy", "SUV", "Luxury", "Van"
  description String?
  sortOrder   Int     @default(0)

  cars        Car[]
  rateRules   RateRule[]
}

model Car {
  id              String       @id @default(cuid())
  make            String
  model           String
  year            Int
  licensePlate    String       @unique
  vin             String       @unique
  categoryId      String
  category        CarCategory  @relation(fields: [categoryId], references: [id])
  transmission    Transmission
  fuelType        FuelType
  seats           Int
  currentMileage  Int          @default(0)
  status          CarStatus    @default(AVAILABLE)
  homeBranchId    String
  homeBranch      Branch       @relation("CarHomeBranch", fields: [homeBranchId], references: [id])
  currentBranchId String?                   // null if in transit
  purchaseCost    Decimal?     @db.Decimal(12, 2)
  purchasedAt     DateTime?
  registrationExpiry DateTime?

  // telematics-ready (nullable in v1)
  gpsDeviceId     String?
  lastKnownLat    Decimal?     @db.Decimal(10, 7)
  lastKnownLng    Decimal?     @db.Decimal(10, 7)
  lastTelemetryAt DateTime?

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  deletedAt       DateTime?

  photos              CarPhoto[]
  transfers           CarTransfer[]
  bookings            Booking[]
  maintenanceRecords  MaintenanceRecord[]
  accidents           AccidentReport[]
  insurancePolicies   InsurancePolicy[]
  lifecycleEvents     CarLifecycleEvent[]
  tags                CarTag[]

  @@index([homeBranchId])
  @@index([currentBranchId])
  @@index([status])
  @@index([categoryId])
  @@index([deletedAt])
}

model CarPhoto {
  id        String   @id @default(cuid())
  carId     String
  car       Car      @relation(fields: [carId], references: [id], onDelete: Cascade)
  storageKey String
  caption   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@index([carId])
}

model CarTransfer {
  id             String   @id @default(cuid())
  carId          String
  car            Car      @relation(fields: [carId], references: [id])
  fromBranchId   String
  toBranchId     String
  initiatedAt    DateTime @default(now())
  completedAt    DateTime?
  initiatedById  String
  notes          String?

  @@index([carId])
}

model CarLifecycleEvent {
  id           String   @id @default(cuid())
  carId        String
  car          Car      @relation(fields: [carId], references: [id])
  kind         String   // 'tire_change' | 'battery_change' | 'major_service' | ...
  atMileage    Int
  occurredAt   DateTime
  nextDueAt    DateTime?
  nextDueAtMileage Int?
  notes        String?

  @@index([carId])
}

model InsurancePolicy {
  id            String   @id @default(cuid())
  carId         String
  car           Car      @relation(fields: [carId], references: [id])
  provider      String
  policyNumber  String
  coverage      String
  startAt       DateTime
  expiryAt      DateTime
  premium       Decimal? @db.Decimal(12, 2)
  currency      String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  claims        InsuranceClaim[]

  @@index([carId])
  @@index([expiryAt])
}

model InsuranceClaim {
  id          String   @id @default(cuid())
  policyId    String
  policy      InsurancePolicy @relation(fields: [policyId], references: [id])
  accidentId  String?
  amount      Decimal? @db.Decimal(12, 2)
  status      String   // 'open' | 'in_review' | 'paid' | 'rejected'
  filedAt     DateTime
  resolvedAt  DateTime?
  notes       String?
}
```

---

## Customers & Drivers

```prisma
enum CustomerSource {
  ADMIN_CREATED
  SELF_REGISTERED
  WALK_IN
}

enum CustomerFlag {
  BLACKLISTED
  WATCHLIST
  VIP
}

model Customer {
  id            String   @id @default(cuid())
  fullName      String
  email         String?
  phone         String
  address       String?
  nationality   String?
  dateOfBirth   DateTime?
  source        CustomerSource
  flag          CustomerFlag?
  flagReason    String?
  corporateAccountId String?
  corporateAccount   CorporateAccount? @relation(fields: [corporateAccountId], references: [id])
  internalNotes String?
  visibleNotes  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  licenses      DriverLicense[]
  bookings      Booking[]
  tags          CustomerTag[]

  @@index([phone])
  @@index([email])
  @@index([corporateAccountId])
  @@index([deletedAt])
}

model DriverLicense {
  id            String   @id @default(cuid())
  customerId    String?
  customer      Customer? @relation(fields: [customerId], references: [id])
  // OR linked to an additional driver via additionalDriverId
  additionalDriverId String?
  number        String
  expiryAt      DateTime
  photoKey      String?       // S3
  country       String?
  createdAt     DateTime @default(now())

  @@index([customerId])
  @@index([additionalDriverId])
  @@index([expiryAt])
}

model AdditionalDriver {
  id           String   @id @default(cuid())
  bookingId    String
  booking      Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  fullName     String
  age          Int
  phone        String?
  licenses     DriverLicense[]

  @@index([bookingId])
}

model CorporateAccount {
  id              String   @id @default(cuid())
  name            String
  contactName     String
  contactEmail    String
  contactPhone    String?
  billingAddress  String
  taxId           String?
  defaultRatePlanId String?
  consolidatedInvoicing Boolean @default(true)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  customers       Customer[]
  bookings        Booking[]

  @@index([deletedAt])
}
```

---

## Rates & Pricing

```prisma
model RatePlan {
  id          String   @id @default(cuid())
  name        String
  branchId    String?              // null = global
  branch      Branch?  @relation(fields: [branchId], references: [id])
  corporateAccountId String?
  startAt     DateTime
  endAt       DateTime
  priority    Int      @default(0) // higher wins on equal specificity
  isActive    Boolean  @default(true)
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  rules       RateRule[]
  extras      ExtraPrice[]

  @@index([branchId])
  @@index([startAt, endAt])
}

model RateRule {
  id          String   @id @default(cuid())
  ratePlanId  String
  ratePlan    RatePlan @relation(fields: [ratePlanId], references: [id], onDelete: Cascade)
  categoryId  String
  category    CarCategory @relation(fields: [categoryId], references: [id])
  dailyRate   Decimal  @db.Decimal(12, 2)
  weeklyRate  Decimal? @db.Decimal(12, 2)
  monthlyRate Decimal? @db.Decimal(12, 2)
  currency    String

  @@unique([ratePlanId, categoryId])
}

model Extra {
  id          String   @id @default(cuid())
  code        String   @unique       // e.g. 'gps', 'child_seat', 'additional_driver'
  name        String                  // localized via key
  pricingMode String                  // 'per_day' | 'per_rental' | 'per_unit'
  isActive    Boolean  @default(true)

  prices      ExtraPrice[]
  bookingItems BookingExtra[]
}

model ExtraPrice {
  id         String   @id @default(cuid())
  extraId    String
  extra      Extra    @relation(fields: [extraId], references: [id])
  ratePlanId String
  ratePlan   RatePlan @relation(fields: [ratePlanId], references: [id], onDelete: Cascade)
  amount     Decimal  @db.Decimal(12, 2)
  currency   String

  @@unique([extraId, ratePlanId])
}

model PromoCode {
  id           String   @id @default(cuid())
  code         String   @unique
  description  String?
  discountType String   // 'percent' | 'fixed'
  amount       Decimal  @db.Decimal(12, 2)
  currency     String?
  validFrom    DateTime
  validUntil   DateTime
  maxUses      Int?
  usedCount    Int      @default(0)
  stackable    Boolean  @default(false)
  isActive     Boolean  @default(true)

  bookings     Booking[]
}

model CrossBranchFee {
  id           String   @id @default(cuid())
  fromBranchId String
  toBranchId   String
  amount       Decimal  @db.Decimal(12, 2)
  currency     String

  @@unique([fromBranchId, toBranchId])
}

model CancellationPolicy {
  id        String   @id @default(cuid())
  branchId  String   @unique
  branch    Branch   @relation(fields: [branchId], references: [id])
  tiers     Json     // [{ hoursBefore: 48, refundPercent: 100 }, ...]
  updatedAt DateTime @updatedAt
}
```

---

## Bookings

```prisma
enum BookingStatus {
  HOLD
  PENDING
  CONFIRMED
  ACTIVE
  COMPLETED
  CANCELLED
  NO_SHOW
  OVERDUE
}

enum FuelPolicy {
  FULL_TO_FULL
  PREPAID_FULL
  RETURN_AS_RECEIVED
}

model Booking {
  id                String        @id @default(cuid())
  bookingNumber     String        @unique  // human-friendly, branch-prefixed
  customerId        String
  customer          Customer      @relation(fields: [customerId], references: [id])
  corporateAccountId String?
  corporateAccount  CorporateAccount? @relation(fields: [corporateAccountId], references: [id])
  carId             String
  car               Car           @relation(fields: [carId], references: [id])
  pickupBranchId    String
  pickupBranch      Branch        @relation("BookingPickupBranch", fields: [pickupBranchId], references: [id])
  returnBranchId    String
  returnBranch      Branch        @relation("BookingReturnBranch", fields: [returnBranchId], references: [id])

  pickupAt          DateTime      // UTC
  returnAt          DateTime      // UTC
  actualPickupAt    DateTime?
  actualReturnAt    DateTime?

  status            BookingStatus @default(HOLD)
  holdExpiresAt     DateTime?

  fuelPolicy        FuelPolicy
  mileageAllowancePerDay Int?     // null = unlimited
  expectedKm        Int?

  promoCodeId       String?
  promoCode         PromoCode?    @relation(fields: [promoCodeId], references: [id])

  ratePlanId        String
  ratePlanVersion   Int

  // Snapshot — set on confirmation, immutable thereafter
  priceSnapshot     Json
  currency          String
  totalAmount       Decimal       @db.Decimal(12, 2)

  // Driver's license snapshot at booking time
  licenseSnapshot   Json

  // Cross-border / geofence flag
  leavesCountry     Boolean       @default(false)

  internalNotes     String?
  visibleNotes      String?

  createdById       String
  createdBy         User          @relation("BookingCreator", fields: [createdById], references: [id])
  updatedById       String?
  updatedBy         User?         @relation("BookingModifier", fields: [updatedById], references: [id])

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  deletedAt         DateTime?

  extras            BookingExtra[]
  additionalDrivers AdditionalDriver[]
  modifications     BookingModification[]
  inspections       Inspection[]
  payments          Payment[]
  invoices          Invoice[]
  damages           DamageRecord[]
  fines             Fine[]
  tags              BookingTag[]

  @@index([customerId])
  @@index([carId])
  @@index([pickupBranchId])
  @@index([returnBranchId])
  @@index([status])
  @@index([pickupAt, returnAt])
  @@index([deletedAt])
  // EXCLUSION CONSTRAINT added via raw SQL migration: see below
}

model BookingExtra {
  id         String  @id @default(cuid())
  bookingId  String
  booking    Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  extraId    String
  extra      Extra   @relation(fields: [extraId], references: [id])
  quantity   Int
  unitAmount Decimal @db.Decimal(12, 2)
  currency   String

  @@index([bookingId])
}

model BookingModification {
  id               String        @id @default(cuid())
  bookingId        String
  booking          Booking       @relation(fields: [bookingId], references: [id])
  kind             String        // 'extension' | 'car_swap' | 'branch_change'
  beforeSnapshot   Json
  afterSnapshot    Json
  newPriceSnapshot Json
  newTotal         Decimal       @db.Decimal(12, 2)
  reason           String?
  createdById      String
  createdAt        DateTime      @default(now())

  @@index([bookingId])
}
```

**DB-level booking overlap exclusion** (raw migration):

```sql
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "carId" WITH =,
    tstzrange("pickupAt", "returnAt") WITH &&
  )
  WHERE ("status" IN ('HOLD', 'CONFIRMED', 'ACTIVE') AND "deletedAt" IS NULL);
```

This guarantees the no-double-booking rule at the database level.

---

## Inspections, Damage, Fines

```prisma
enum InspectionKind {
  PICKUP
  RETURN
}

model Inspection {
  id            String         @id @default(cuid())
  bookingId     String
  booking       Booking        @relation(fields: [bookingId], references: [id])
  kind          InspectionKind
  performedAt   DateTime       @default(now())
  performedById String
  mileage       Int
  fuelLevel     Int            // 0-100 percent
  exteriorDamage Json          // damage diagram coordinates + notes
  interiorCondition String?
  customerSignatureKey String?
  staffSignatureKey    String?
  photos        InspectionPhoto[]

  @@index([bookingId])
}

model InspectionPhoto {
  id            String     @id @default(cuid())
  inspectionId  String
  inspection    Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
  storageKey    String
  position      String     // 'front' | 'rear' | 'left' | 'right' | 'dashboard' | 'odometer' | 'fuel_gauge'
  capturedAt    DateTime   @default(now())

  @@index([inspectionId])
}

model DamageRecord {
  id          String   @id @default(cuid())
  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])
  inspectionId String?
  description String
  estimatedCost Decimal @db.Decimal(12, 2)
  currency    String
  invoicedItemId String?   // links to addendum invoice line
  createdAt   DateTime @default(now())

  @@index([bookingId])
}

model Fine {
  id           String   @id @default(cuid())
  bookingId    String
  booking      Booking  @relation(fields: [bookingId], references: [id])
  kind         String   // 'traffic' | 'toll' | 'parking' | 'other'
  externalRef  String?  // citation number
  occurredAt   DateTime
  amount       Decimal  @db.Decimal(12, 2)
  currency     String
  serviceFee   Decimal? @db.Decimal(12, 2)
  invoicedItemId String?
  notes        String?
  createdAt    DateTime @default(now())

  @@index([bookingId])
  @@index([occurredAt])
}
```

---

## Money

```prisma
enum PaymentMethod {
  CASH
  CARD
  BANK_TRANSFER
}

enum PaymentKind {
  RENTAL
  DEPOSIT
  ADDENDUM  // damage/fines
}

model Payment {
  id             String        @id @default(cuid())
  bookingId      String
  booking        Booking       @relation(fields: [bookingId], references: [id])
  kind           PaymentKind
  method         PaymentMethod
  amount         Decimal       @db.Decimal(12, 2)
  currency       String
  reference      String?       // bank ref / card last 4 / receipt number
  recordedById   String
  recordedBy     User          @relation("PaymentRecorder", fields: [recordedById], references: [id])
  recordedAt     DateTime      @default(now())
  idempotencyKey String        @unique
  voidedAt       DateTime?
  voidedById     String?
  voidReason     String?

  @@index([bookingId])
  @@index([kind])
  @@index([recordedAt])
}

model Refund {
  id             String   @id @default(cuid())
  bookingId      String
  paymentId      String?  // optional link to a specific payment
  invoiceId      String?
  amount         Decimal  @db.Decimal(12, 2)
  currency       String
  reason         String
  requestedById  String
  approvedById   String?  // required if amount > two-person threshold
  status         String   // 'pending' | 'approved' | 'paid' | 'rejected'
  createdAt      DateTime @default(now())
  paidAt         DateTime?
  idempotencyKey String   @unique

  @@index([bookingId])
}

model Invoice {
  id            String   @id @default(cuid())
  invoiceNumber String   @unique       // branch-prefixed
  branchId      String
  bookingId     String
  booking       Booking  @relation(fields: [bookingId], references: [id])
  kind          String   // 'rental' | 'addendum'
  issuedAt      DateTime @default(now())
  dueAt         DateTime?
  currency      String
  subtotal      Decimal  @db.Decimal(12, 2)
  discountTotal Decimal  @db.Decimal(12, 2)
  taxTotal      Decimal  @db.Decimal(12, 2)
  total         Decimal  @db.Decimal(12, 2)
  lineItems     Json
  taxLines      Json
  pdfKey        String?  // S3 key for generated PDF
  language      String   // 'en' | 'ar'
  voidedAt      DateTime?
  voidedReason  String?
  deletedAt     DateTime?

  creditNotes   CreditNote[]

  @@index([branchId])
  @@index([bookingId])
  @@index([issuedAt])
  @@index([deletedAt])
}

model CreditNote {
  id              String   @id @default(cuid())
  creditNoteNumber String  @unique
  invoiceId       String
  invoice         Invoice  @relation(fields: [invoiceId], references: [id])
  amount          Decimal  @db.Decimal(12, 2)
  currency        String
  reason          String
  lineItems       Json
  pdfKey          String?
  issuedAt        DateTime @default(now())
  language        String

  @@index([invoiceId])
}

model FxRate {
  id        String   @id @default(cuid())
  fromCurrency String
  toCurrency   String
  rate         Decimal  @db.Decimal(18, 8)
  effectiveAt  DateTime

  @@unique([fromCurrency, toCurrency, effectiveAt])
}
```

---

## Maintenance & Accidents

```prisma
enum MaintenanceKind {
  SCHEDULED
  UNSCHEDULED
}

model MaintenanceRecord {
  id           String           @id @default(cuid())
  carId        String
  car          Car              @relation(fields: [carId], references: [id])
  kind         MaintenanceKind
  startedAt    DateTime
  completedAt  DateTime?
  mileageAt    Int
  cost         Decimal          @db.Decimal(12, 2)
  currency     String
  description  String
  vendorId     String?
  vendor       MaintenanceVendor? @relation(fields: [vendorId], references: [id])
  mechanicId   String?           // internal user
  partsUsed    MaintenancePart[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  deletedAt    DateTime?

  @@index([carId])
  @@index([kind])
  @@index([startedAt])
}

model MaintenanceVendor {
  id          String   @id @default(cuid())
  name        String
  contact     String?
  phone       String?
  specialty   String?
  warrantyTerms String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  deletedAt   DateTime?

  maintenance MaintenanceRecord[]
}

model Part {
  id            String   @id @default(cuid())
  sku           String   @unique
  name          String
  description   String?
  unitCost      Decimal  @db.Decimal(12, 2)
  currency      String
  lowStockThreshold Int  @default(0)

  stock         PartStock[]
}

model PartStock {
  id         String  @id @default(cuid())
  partId     String
  part       Part    @relation(fields: [partId], references: [id])
  branchId   String
  quantity   Int

  @@unique([partId, branchId])
}

model MaintenancePart {
  id                  String @id @default(cuid())
  maintenanceRecordId String
  maintenanceRecord   MaintenanceRecord @relation(fields: [maintenanceRecordId], references: [id], onDelete: Cascade)
  partId              String
  part                Part @relation(fields: [partId], references: [id])
  quantity            Int
  unitCost            Decimal @db.Decimal(12, 2)
}

model AccidentReport {
  id              String   @id @default(cuid())
  carId           String
  car             Car      @relation(fields: [carId], references: [id])
  bookingId       String?
  occurredAt      DateTime
  location        String?
  policeReportRef String?
  description     String
  thirdPartyDetails Json?
  insuranceClaimId String?
  photos          Json?    // S3 keys
  reportedById    String
  createdAt       DateTime @default(now())
  deletedAt       DateTime?

  @@index([carId])
  @@index([bookingId])
  @@index([occurredAt])
}
```

---

## Platform

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id])
  action     String   // e.g. 'booking.cancel', 'permission.override.grant'
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  userAgent  String?
  occurredAt DateTime @default(now())

  @@index([actorId])
  @@index([entityType, entityId])
  @@index([occurredAt])
  @@index([action])
}

model Notification {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind       String
  payload    Json
  channel    String   // 'in_app' | 'email'
  readAt     DateTime?
  sentAt     DateTime?
  failedAt   DateTime?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([readAt])
}

model Webhook {
  id           String   @id @default(cuid())
  name         String
  url          String
  secret       String
  events       String[]
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  deliveries   WebhookDelivery[]
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  webhook     Webhook  @relation(fields: [webhookId], references: [id])
  event       String
  payload     Json
  status      String   // 'pending' | 'success' | 'failed'
  attempts    Int      @default(0)
  lastError   String?
  deliveredAt DateTime?
  createdAt   DateTime @default(now())

  @@index([webhookId])
  @@index([status])
}

model ApiKey {
  id         String   @id @default(cuid())
  name       String
  hash       String   @unique
  scopes     String[]
  createdById String
  createdAt  DateTime @default(now())
  revokedAt  DateTime?
  lastUsedAt DateTime?
}

model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique
  enabled     Boolean  @default(false)
  rolloutPct  Int      @default(0)
  roles       Role[]
  updatedAt   DateTime @updatedAt
}

model StylingProfile {
  id           String   @id @default(cuid())
  isActive     Boolean  @default(false)
  logoKey      String?
  altLogoKey   String?
  faviconKey   String?
  tokens       Json     // CSS variable map: colors, fonts, radii, spacing
  darkTokens   Json     // overrides for dark mode
  updatedAt    DateTime @updatedAt
  updatedById  String
}

model Setting {
  id     String  @id @default(cuid())
  key    String  @unique
  value  Json
  updatedAt DateTime @updatedAt
  updatedById String
}

model SavedView {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  page      String   // 'bookings' | 'cars' | ...
  name      String
  filters   Json
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, page])
}

model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String?

  cars      CarTag[]
  customers CustomerTag[]
  bookings  BookingTag[]
}

model CarTag {
  carId String
  car   Car @relation(fields: [carId], references: [id], onDelete: Cascade)
  tagId String
  tag   Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([carId, tagId])
}

model CustomerTag {
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tagId      String
  tag        Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([customerId, tagId])
}

model BookingTag {
  bookingId String
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  tagId     String
  tag       Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([bookingId, tagId])
}
```

---

## Seed Data

The Prisma seed script (`prisma/seed.ts`) should produce:

- Default role permissions for every role × every page × every standard action.
- A Super Admin user (credentials prompted via env).
- One example branch (Cairo) with timezone, currency, tax config, business hours.
- A small fleet (5–10 cars across categories) with photos.
- One CarCategory per standard class.
- One default RatePlan + RateRules per category.
- A few sample Extras (GPS, child seat, additional driver, insurance package).
- An initial StylingProfile with sensible defaults.
- Feature flags (all off).

---

## Migration Strategy

- Every schema change is a separate, named migration.
- Raw SQL needed for the booking exclusion constraint and any other GiST/partial indexes.
- For each migration introducing a snapshot field on a financial entity, backfill is **not** required — old records remain valid; new logic only applies to records created after the migration.
- Production migrations are gated on backup completion.

---

## Indexing Beyond the Obvious

- `Booking(pickupAt, returnAt, carId)` for overlap checks (in addition to the exclusion constraint).
- `Booking(status, returnAt)` for the overdue-detection job.
- `Invoice(branchId, issuedAt)` for monthly financial reports.
- `AuditLog(entityType, entityId, occurredAt)` for entity history views.
- `InsurancePolicy(expiryAt)` and `DriverLicense(expiryAt)` for expiry-alert jobs.

---

## What's NOT in the schema (intentional)

- Customer-facing portal models — out of scope for v1.
- Online payment gateway transactions — payments are recorded manually.
- Telematics history (just last-known + nullable fields) — full track logs would belong in a time-series store later.
- Email templates — handled via code/Nodemailer templates, not stored as DB rows in v1.
