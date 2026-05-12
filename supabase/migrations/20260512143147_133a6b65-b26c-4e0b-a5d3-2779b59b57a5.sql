CREATE POLICY "Eduardo and Thiago can transfer any client"
ON public.clients
FOR UPDATE
TO authenticated
USING (auth.uid() IN ('03101aff-ecaf-4bd8-b6fb-27ddd6dac862'::uuid, '3578ef9e-53e5-400d-a666-c9ba2d63a222'::uuid))
WITH CHECK (auth.uid() IN ('03101aff-ecaf-4bd8-b6fb-27ddd6dac862'::uuid, '3578ef9e-53e5-400d-a666-c9ba2d63a222'::uuid));