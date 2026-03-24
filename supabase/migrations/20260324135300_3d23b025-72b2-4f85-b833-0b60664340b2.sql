
DROP POLICY IF EXISTS "Everyone can update fairs" ON feiras;

CREATE POLICY "Admins and gestores can update fairs"
  ON feiras FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Vendedores can update own fairs"
  ON feiras FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by AND has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK (auth.uid() = created_by AND has_role(auth.uid(), 'vendedor'::app_role));
