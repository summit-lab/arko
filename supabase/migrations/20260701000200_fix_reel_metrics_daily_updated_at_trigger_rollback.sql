-- Rollback: recrea el trigger (¡restaura el bug! solo por completitud).
CREATE TRIGGER handle_updated_at_reel_metrics_daily
  BEFORE UPDATE ON public.reel_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
