-- FundChain: creator-controlled Explore visibility.
-- Hiding a campaign changes public discovery only; it does not cancel
-- the campaign or alter any on-chain records or donation permissions.

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.set_campaign_visibility(
    p_campaign_id UUID,
    p_is_listed BOOLEAN
)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_campaign public.campaigns;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    UPDATE public.campaigns
    SET is_listed = p_is_listed
    WHERE id = p_campaign_id
      AND creator_id = auth.uid()
      AND status = 'active'
    RETURNING * INTO updated_campaign;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Campaign not found, not owned by you, or not published';
    END IF;

    RETURN updated_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.set_campaign_visibility(UUID, BOOLEAN)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_campaign_visibility(UUID, BOOLEAN)
TO authenticated;
