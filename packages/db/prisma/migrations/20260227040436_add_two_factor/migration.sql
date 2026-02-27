-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('SOLVED_PROBLEM', 'GROUP');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('READ', 'WRITE');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('SERVER', 'CLIENT');

-- CreateTable
CREATE TABLE "share" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_access" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "api_key_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft" (
    "id" TEXT NOT NULL,
    "solvedProblemId" TEXT,
    "proposedData" JSONB NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "signupEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solved_problem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "copiedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solved_problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solved_problem_version" (
    "id" TEXT NOT NULL,
    "solvedProblemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solved_problem_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solved_problem_tag" (
    "solvedProblemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "solved_problem_tag_pkey" PRIMARY KEY ("solvedProblemId","tagId")
);

-- CreateTable
CREATE TABLE "dependency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "packageManager" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL,
    "solvedProblemId" TEXT NOT NULL,

    CONSTRAINT "dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solved_problem_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "solved_problem_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_membership" (
    "groupId" TEXT NOT NULL,
    "solvedProblemId" TEXT NOT NULL,

    CONSTRAINT "group_membership_pkey" PRIMARY KEY ("groupId","solvedProblemId")
);

-- CreateIndex
CREATE INDEX "share_sharedWithUserId_idx" ON "share"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "share_sharedByUserId_idx" ON "share"("sharedByUserId");

-- CreateIndex
CREATE INDEX "share_resourceType_resourceId_idx" ON "share"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_hashedKey_key" ON "api_key"("hashedKey");

-- CreateIndex
CREATE INDEX "api_key_userId_idx" ON "api_key"("userId");

-- CreateIndex
CREATE INDEX "api_key_access_apiKeyId_idx" ON "api_key_access"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_key_access_resourceType_resourceId_idx" ON "api_key_access"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "draft_createdByUserId_idx" ON "draft"("createdByUserId");

-- CreateIndex
CREATE INDEX "draft_solvedProblemId_idx" ON "draft"("solvedProblemId");

-- CreateIndex
CREATE INDEX "draft_status_idx" ON "draft"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "twoFactor_userId_key" ON "twoFactor"("userId");

-- CreateIndex
CREATE INDEX "solved_problem_ownerId_idx" ON "solved_problem"("ownerId");

-- CreateIndex
CREATE INDEX "solved_problem_version_solvedProblemId_idx" ON "solved_problem_version"("solvedProblemId");

-- CreateIndex
CREATE UNIQUE INDEX "solved_problem_version_solvedProblemId_version_key" ON "solved_problem_version"("solvedProblemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE INDEX "solved_problem_tag_tagId_idx" ON "solved_problem_tag"("tagId");

-- CreateIndex
CREATE INDEX "dependency_solvedProblemId_idx" ON "dependency"("solvedProblemId");

-- CreateIndex
CREATE INDEX "dependency_type_idx" ON "dependency"("type");

-- CreateIndex
CREATE INDEX "solved_problem_group_ownerId_idx" ON "solved_problem_group"("ownerId");

-- CreateIndex
CREATE INDEX "group_membership_solvedProblemId_idx" ON "group_membership"("solvedProblemId");

-- AddForeignKey
ALTER TABLE "share" ADD CONSTRAINT "share_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share" ADD CONSTRAINT "share_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_access" ADD CONSTRAINT "api_key_access_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft" ADD CONSTRAINT "draft_solvedProblemId_fkey" FOREIGN KEY ("solvedProblemId") REFERENCES "solved_problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft" ADD CONSTRAINT "draft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft" ADD CONSTRAINT "draft_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problem" ADD CONSTRAINT "solved_problem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problem" ADD CONSTRAINT "solved_problem_copiedFromId_fkey" FOREIGN KEY ("copiedFromId") REFERENCES "solved_problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problem_version" ADD CONSTRAINT "solved_problem_version_solvedProblemId_fkey" FOREIGN KEY ("solvedProblemId") REFERENCES "solved_problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problem_tag" ADD CONSTRAINT "solved_problem_tag_solvedProblemId_fkey" FOREIGN KEY ("solvedProblemId") REFERENCES "solved_problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problem_tag" ADD CONSTRAINT "solved_problem_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_solvedProblemId_fkey" FOREIGN KEY ("solvedProblemId") REFERENCES "solved_problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solved_problem_group" ADD CONSTRAINT "solved_problem_group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "solved_problem_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_solvedProblemId_fkey" FOREIGN KEY ("solvedProblemId") REFERENCES "solved_problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
