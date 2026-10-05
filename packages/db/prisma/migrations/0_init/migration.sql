-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'PHONE');

-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM ('CUSTOMER_CREATED', 'RESERVATION_CREATED', 'RESERVATION_CANCELLED', 'RESERVATION_RESCHEDULED', 'RESERVATION_CHANGE_REQUESTED', 'PROFILE_UPDATED', 'CHAT_SESSION_CREATED', 'CHAT_MESSAGE_RECEIVED', 'CHAT_ESCALATED', 'TICKET_CREATED', 'TICKET_REPLY_RECEIVED', 'ORDER_CREATED', 'ORDER_CANCELLED', 'WALLET_RECHARGE', 'PRODUCT_REVIEW_CREATED');

-- CreateEnum
CREATE TYPE "AdminNotificationEntityType" AS ENUM ('PROFILE', 'RESERVATION', 'CHAT_SESSION', 'CHAT_MESSAGE', 'TICKET', 'TICKET_MESSAGE', 'ORDER', 'WALLET_TRANSACTION', 'PRODUCT_REVIEW');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('RESCHEDULE', 'CANCEL');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('ACTIVE', 'WAITING', 'AGENT_JOINED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChatTier" AS ENUM ('FAQ', 'AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('GENERAL_INQUIRY', 'RESERVATIONS', 'COMPLAINTS_SUGGESTIONS', 'BILLING', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_REPLY', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketMessageSenderRole" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('COUPON', 'AUTOMATIC', 'HAPPY_HOUR');

-- CreateEnum
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('RECHARGE', 'ADJUST_ADD', 'ADJUST_DEDUCT', 'ADJUST_SET', 'PURCHASE', 'REFUND');

-- CreateEnum
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "BillingDocumentType" AS ENUM ('BOLETA', 'FACTURA');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'MANUAL');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('CREATED', 'PAID', 'STATUS_CHANGED', 'CANCELLED', 'REFUNDED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "DeliveryZoneType" AS ENUM ('AREA', 'POLYGON', 'RADIUS');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "email" TEXT,
    "recoveryEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recoveryPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phoneCountryCode" TEXT,
    "phoneNumber" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "connections" "AuthProvider"[] DEFAULT ARRAY[]::"AuthProvider"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "slug" TEXT NOT NULL,
    "slugEs" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'default',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "draftData" JSONB,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "sku" VARCHAR(30),
    "slug" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prices" JSONB NOT NULL DEFAULT '{"PEN":0,"USD":0}',
    "nameEs" TEXT,
    "descriptionEs" TEXT,
    "tagsEs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slugEs" TEXT,
    "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ingredientsEs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[],
    "tagColors" JSONB,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL,
    "notes" TEXT,
    "nickname" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "remindedAt" TIMESTAMP(3),
    "hiddenByUser" BOOLEAN NOT NULL DEFAULT false,
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "adminViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorDisplayName" TEXT,
    "authorAvatarUrl" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000) NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorDisplayName" TEXT,
    "authorAvatarUrl" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationChangeRequest" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "profileId" TEXT,
    "type" "ChangeRequestType" NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "message" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "sessionKey" TEXT NOT NULL,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "tier" "ChatTier" NOT NULL DEFAULT 'AI',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "adminId" TEXT,
    "hiddenByUser" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tier" "ChatTier" NOT NULL DEFAULT 'AI',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCounter" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "priorityLockedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "assignedAdminId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "hiddenByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" "TicketMessageSenderRole" NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "valueType" "DiscountValueType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "valueUsd" DECIMAL(10,2),
    "code" TEXT,
    "minPartySize" INTEGER,
    "categoryId" TEXT,
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "menuItemId" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "daysOfWeek" INTEGER[],
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "applyToNone" BOOLEAN NOT NULL DEFAULT false,
    "excludedItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "draftData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountApplication" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "profileId" TEXT,
    "reservationId" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "key" TEXT NOT NULL DEFAULT 'global',
    "advanceReservationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "advanceReservationValue" INTEGER NOT NULL DEFAULT 2,
    "advanceReservationUnit" TEXT NOT NULL DEFAULT 'hours',
    "productImageLimit" INTEGER NOT NULL DEFAULT 4,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'PEN',
    "reviewPhotoLimit" INTEGER NOT NULL DEFAULT 3,
    "liveChatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sageShareIngredients" BOOLEAN NOT NULL DEFAULT true,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiBaseUrl" TEXT NOT NULL DEFAULT '',
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "aiSummaryModel" TEXT NOT NULL DEFAULT '',
    "aiTemperature" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "aiMaxTokens" INTEGER NOT NULL DEFAULT 600,
    "galleryAutoPlayInterval" INTEGER NOT NULL DEFAULT 5,
    "reviewsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxPartySize" INTEGER NOT NULL DEFAULT 40,
    "largeGroupWarningFrom" INTEGER NOT NULL DEFAULT 8,
    "maxReservationsPerSlot" INTEGER NOT NULL DEFAULT 8,
    "timeSlotIncrement" INTEGER NOT NULL DEFAULT 30,
    "reservationDurationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reservationDurationValue" INTEGER NOT NULL DEFAULT 1,
    "reservationDurationUnit" TEXT NOT NULL DEFAULT 'hours',
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 30,
    "operatingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "openingTime" TEXT NOT NULL DEFAULT '09:00',
    "closingTime" TEXT NOT NULL DEFAULT '22:00',
    "closedTimeRanges" JSONB NOT NULL DEFAULT '[]',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "contactAddress" TEXT NOT NULL DEFAULT '',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "publicContactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhoneHoursNoteEn" TEXT NOT NULL DEFAULT '',
    "contactPhoneHoursNoteEs" TEXT NOT NULL DEFAULT '',
    "chatBubblePosition" TEXT NOT NULL DEFAULT 'right',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "adminEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" TEXT NOT NULL DEFAULT '',
    "walletEnabled" BOOLEAN NOT NULL DEFAULT true,
    "walletAllowDualCurrency" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupLeadTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "defaultDeliveryFeePEN" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultDeliveryFeeUSD" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minOrderGlobalPEN" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minOrderGlobalUSD" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "restaurantLat" DECIMAL(10,7),
    "restaurantLng" DECIMAL(10,7),
    "orderNumberPrefix" TEXT NOT NULL DEFAULT 'WG',
    "companyRuc" TEXT NOT NULL DEFAULT '',
    "companyLegalName" TEXT NOT NULL DEFAULT '',
    "companyFiscalAddress" TEXT NOT NULL DEFAULT '',
    "igvRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "boletaSeries" TEXT NOT NULL DEFAULT 'B001',
    "facturaSeries" TEXT NOT NULL DEFAULT 'F001',
    "boletaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "facturaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dashboardKitchenAlertMinutes" INTEGER NOT NULL DEFAULT 20,
    "dashboardPickupAlertMinutes" INTEGER NOT NULL DEFAULT 10,
    "dashboardLowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "dashboardEtaToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "dashboardDefaultPreset" TEXT NOT NULL DEFAULT 'today',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "type" "AdminNotificationType" NOT NULL,
    "entityType" "AdminNotificationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "message" VARCHAR(280) NOT NULL,
    "href" VARCHAR(255),
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "WalletDirection" NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "performedById" TEXT,
    "note" VARCHAR(280),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "guestKey" TEXT,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(140),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillment" "FulfillmentMethod" NOT NULL,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'WALLET',
    "paymentProviderRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "estimatedReadyAt" TIMESTAMP(3),
    "deliveryAddress" VARCHAR(255),
    "deliveryAddressDetail" VARCHAR(140),
    "deliveryLat" DECIMAL(10,7),
    "deliveryLng" DECIMAL(10,7),
    "deliveryZoneId" TEXT,
    "deliveryZoneName" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "notes" VARCHAR(280),
    "cancelReason" VARCHAR(280),
    "hiddenByUser" BOOLEAN NOT NULL DEFAULT false,
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "documentType" "BillingDocumentType" NOT NULL DEFAULT 'BOLETA',
    "documentSeries" TEXT,
    "documentNumber" TEXT,
    "buyerDni" VARCHAR(8),
    "fiscalRuc" VARCHAR(11),
    "fiscalLegalName" VARCHAR(200),
    "fiscalAddress" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "listUnitPrice" DECIMAL(12,2),
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(140),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDiscount" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "codeUsed" TEXT,

    CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "message" VARCHAR(280),
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCounter" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "id" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" VARCHAR(40),
    "recipientName" TEXT,
    "phone" TEXT,
    "fullAddress" VARCHAR(255) NOT NULL,
    "detail" VARCHAR(140),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "country" TEXT,
    "region" TEXT,
    "province" TEXT,
    "district" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeliveryZoneType" NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "feeUsd" DECIMAL(12,2) NOT NULL,
    "minOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minOrderUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 45,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "country" TEXT,
    "region" TEXT,
    "province" TEXT,
    "district" TEXT,
    "centerLat" DECIMAL(10,7),
    "centerLng" DECIMAL(10,7),
    "radiusMeters" INTEGER,
    "polygon" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_slug_key" ON "MenuCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_slugEs_key" ON "MenuCategory"("slugEs");

-- CreateIndex
CREATE INDEX "MenuCategory_isDraft_idx" ON "MenuCategory"("isDraft");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_sku_key" ON "MenuItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_slug_key" ON "MenuItem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_slugEs_key" ON "MenuItem"("slugEs");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_featured_idx" ON "MenuItem"("featured");

-- CreateIndex
CREATE INDEX "MenuItem_slug_idx" ON "MenuItem"("slug");

-- CreateIndex
CREATE INDEX "MenuItem_isDraft_idx" ON "MenuItem"("isDraft");

-- CreateIndex
CREATE INDEX "MenuItem_parentId_idx" ON "MenuItem"("parentId");

-- CreateIndex
CREATE INDEX "Reservation_date_idx" ON "Reservation"("date");

-- CreateIndex
CREATE INDEX "Reservation_profileId_idx" ON "Reservation"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reservationId_key" ON "Review"("reservationId");

-- CreateIndex
CREATE INDEX "Review_approved_hidden_pinned_createdAt_idx" ON "Review"("approved", "hidden", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_menuItemId_approved_hidden_pinned_createdAt_idx" ON "ProductReview"("menuItemId", "approved", "hidden", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_approved_hidden_createdAt_idx" ON "ProductReview"("approved", "hidden", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_profileId_menuItemId_key" ON "ProductReview"("profileId", "menuItemId");

-- CreateIndex
CREATE INDEX "ReservationChangeRequest_reservationId_idx" ON "ReservationChangeRequest"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationChangeRequest_status_idx" ON "ReservationChangeRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_sessionKey_key" ON "ChatSession"("sessionKey");

-- CreateIndex
CREATE INDEX "ChatSession_status_idx" ON "ChatSession"("status");

-- CreateIndex
CREATE INDEX "ChatSession_profileId_idx" ON "ChatSession"("profileId");

-- CreateIndex
CREATE INDEX "ChatSession_blockedAt_idx" ON "ChatSession"("blockedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_profileId_idx" ON "Ticket"("profileId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_assignedAdminId_idx" ON "Ticket"("assignedAdminId");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");

-- CreateIndex
CREATE INDEX "Discount_active_idx" ON "Discount"("active");

-- CreateIndex
CREATE INDEX "Discount_isDraft_idx" ON "Discount"("isDraft");

-- CreateIndex
CREATE INDEX "VerificationCode_profileId_email_idx" ON "VerificationCode"("profileId", "email");

-- CreateIndex
CREATE INDEX "AdminNotification_adminId_isRead_createdAt_idx" ON "AdminNotification"("adminId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_adminId_createdAt_idx" ON "AdminNotification"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_entityType_entityId_idx" ON "AdminNotification"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Wallet_profileId_idx" ON "Wallet"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_profileId_currency_key" ON "Wallet"("profileId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_reference_idx" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_profileId_key" ON "Cart"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestKey_key" ON "Cart"("guestKey");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_menuItemId_key" ON "CartItem"("cartId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_profileId_idx" ON "Order"("profileId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_scheduledFor_idx" ON "Order"("scheduledFor");

-- CreateIndex
CREATE INDEX "UserAddress_profileId_idx" ON "UserAddress"("profileId");

-- CreateIndex
CREATE INDEX "DeliveryZone_active_idx" ON "DeliveryZone"("active");

-- CreateIndex
CREATE INDEX "DeliveryZone_type_idx" ON "DeliveryZone"("type");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationChangeRequest" ADD CONSTRAINT "ReservationChangeRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationChangeRequest" ADD CONSTRAINT "ReservationChangeRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApplication" ADD CONSTRAINT "DiscountApplication_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

