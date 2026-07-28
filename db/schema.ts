import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const familySpaces = sqliteTable("family_spaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const familyMembers = sqliteTable("family_members", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("viewer"),
  status: text("status").notNull().default("invited"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at"),
});

export const elders = sqliteTable("elders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  birthYear: text("birth_year").notNull().default(""),
  birthPlace: text("birth_place").notNull().default(""),
  personality: text("personality").notNull().default(""),
  boundaries: text("boundaries").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  elderId: text("elder_id").notNull(),
  theme: text("theme").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(20),
  questionsJson: text("questions_json").notNull().default("[]"),
  transcript: text("transcript").notNull().default(""),
  summary: text("summary").notNull().default(""),
  audioKey: text("audio_key").notNull().default(""),
  audioType: text("audio_type").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  confirmedAt: text("confirmed_at"),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  interviewId: text("interview_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  timeLabel: text("time_label").notNull().default("时间待确认"),
  location: text("location").notNull().default(""),
  people: text("people").notNull().default(""),
  quote: text("quote").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
