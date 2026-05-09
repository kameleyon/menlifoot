CREATE TABLE public.order_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'new',
  tracking_number text,
  carrier text,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order status"
  ON public.order_status FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage order status"
  ON public.order_status FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_order_status_updated_at
  BEFORE UPDATE ON public.order_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_order_status_session ON public.order_status(stripe_session_id);