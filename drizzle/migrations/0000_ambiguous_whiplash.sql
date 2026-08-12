CREATE TYPE "public"."active_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."option_label" AS ENUM('A', 'B', 'C', 'D', 'E');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('multiple_choice', 'true_false', 'short_answer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"attemptId" integer NOT NULL,
	"questionId" integer NOT NULL,
	"selectedAnswer" text,
	"correctAnswer" text NOT NULL,
	"isCorrect" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"answeredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessmentId" integer NOT NULL,
	"questionId" integer NOT NULL,
	"questionOrder" integer NOT NULL,
	"points" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"subjectId" integer NOT NULL,
	"grade" varchar(32) DEFAULT '5º Ano' NOT NULL,
	"startDate" timestamp,
	"endDate" timestamp,
	"timeLimit" integer DEFAULT 60 NOT NULL,
	"maxScore" integer DEFAULT 10 NOT NULL,
	"allowSingleAttempt" boolean DEFAULT true NOT NULL,
	"shuffleQuestions" boolean DEFAULT false NOT NULL,
	"shuffleOptions" boolean DEFAULT false NOT NULL,
	"showResultImmediately" boolean DEFAULT true NOT NULL,
	"allowReview" boolean DEFAULT true NOT NULL,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessmentId" integer NOT NULL,
	"studentId" integer NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"finishedAt" timestamp,
	"score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"correctAnswers" integer DEFAULT 0 NOT NULL,
	"wrongAnswers" integer DEFAULT 0 NOT NULL,
	"percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"action" varchar(80) NOT NULL,
	"tableName" varchar(80) NOT NULL,
	"recordId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"grade" varchar(32) DEFAULT '5º Ano' NOT NULL,
	"schoolId" integer NOT NULL,
	"teacherId" integer NOT NULL,
	"year" integer NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"questionId" integer NOT NULL,
	"optionLabel" "option_label" NOT NULL,
	"optionText" text NOT NULL,
	"isCorrect" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subjectId" integer NOT NULL,
	"grade" varchar(32) DEFAULT '5º Ano' NOT NULL,
	"statement" text NOT NULL,
	"questionType" "question_type" DEFAULT 'multiple_choice' NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"unitTheme" varchar(160),
	"skill" varchar(160),
	"descriptor" varchar(160),
	"content" varchar(180),
	"imageUrl" text,
	"correctAnswer" text NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"code" varchar(32) NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"cpf" varchar(14) NOT NULL,
	"schoolId" integer NOT NULL,
	"classId" integer NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(32) NOT NULL,
	"status" "active_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"schoolId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"cpf" varchar(14) NOT NULL,
	"email" varchar(320),
	"status" "active_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "answers_attempt_idx" ON "answers" USING btree ("attemptId");--> statement-breakpoint
CREATE INDEX "answers_question_idx" ON "answers" USING btree ("questionId");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_attempt_question_unique" ON "answers" USING btree ("attemptId","questionId");--> statement-breakpoint
CREATE INDEX "assessment_questions_assessment_idx" ON "assessment_questions" USING btree ("assessmentId");--> statement-breakpoint
CREATE INDEX "assessment_questions_question_idx" ON "assessment_questions" USING btree ("questionId");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_questions_unique" ON "assessment_questions" USING btree ("assessmentId","questionId");--> statement-breakpoint
CREATE INDEX "assessments_subject_idx" ON "assessments" USING btree ("subjectId");--> statement-breakpoint
CREATE INDEX "assessments_status_idx" ON "assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assessments_start_date_idx" ON "assessments" USING btree ("startDate");--> statement-breakpoint
CREATE INDEX "attempts_assessment_idx" ON "attempts" USING btree ("assessmentId");--> statement-breakpoint
CREATE INDEX "attempts_student_idx" ON "attempts" USING btree ("studentId");--> statement-breakpoint
CREATE INDEX "attempts_status_idx" ON "attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_single_unique" ON "attempts" USING btree ("assessmentId","studentId");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "classes_school_idx" ON "classes" USING btree ("schoolId");--> statement-breakpoint
CREATE INDEX "classes_teacher_idx" ON "classes" USING btree ("teacherId");--> statement-breakpoint
CREATE INDEX "classes_year_idx" ON "classes" USING btree ("year");--> statement-breakpoint
CREATE INDEX "question_options_question_idx" ON "question_options" USING btree ("questionId");--> statement-breakpoint
CREATE INDEX "questions_subject_idx" ON "questions" USING btree ("subjectId");--> statement-breakpoint
CREATE INDEX "questions_difficulty_idx" ON "questions" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "questions_skill_idx" ON "questions" USING btree ("skill");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_code_unique" ON "schools" USING btree ("code");--> statement-breakpoint
CREATE INDEX "schools_name_idx" ON "schools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "students_school_idx" ON "students" USING btree ("schoolId");--> statement-breakpoint
CREATE INDEX "students_class_idx" ON "students" USING btree ("classId");--> statement-breakpoint
CREATE INDEX "students_cpf_idx" ON "students" USING btree ("cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_code_unique" ON "subjects" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_user_unique" ON "teachers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "teachers_school_idx" ON "teachers" USING btree ("schoolId");--> statement-breakpoint
CREATE INDEX "teachers_cpf_idx" ON "teachers" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");