CREATE TYPE "public"."order_status" AS ENUM('quote', 'approved', 'in_production', 'ready', 'done');--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" serial NOT NULL,
	"number" text GENERATED ALWAYS AS ('PF-' || lpad(seq::text, 4, '0')) STORED NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text,
	"product_id" text NOT NULL,
	"input" jsonb NOT NULL,
	"breakdown" jsonb NOT NULL,
	"total_sen" integer NOT NULL,
	"pricing_version" integer NOT NULL,
	"status" "order_status" DEFAULT 'quote' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_status_events_order_idx" ON "order_status_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");