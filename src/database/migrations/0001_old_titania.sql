CREATE TABLE "context_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"previous_hash" varchar(64),
	"new_hash" varchar(64),
	"change_metadata" jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_file_path" varchar(1000) NOT NULL,
	"source_type_id" varchar(100) NOT NULL,
	"content_text" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"file_size" integer NOT NULL,
	"last_modified" timestamp NOT NULL,
	"ingested_at" timestamp DEFAULT now() NOT NULL,
	"ingestion_metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "context_changes" ADD CONSTRAINT "context_changes_snapshot_id_context_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."context_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_changes" ADD CONSTRAINT "context_changes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_snapshots" ADD CONSTRAINT "context_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;