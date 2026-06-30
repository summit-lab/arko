import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Crear cuenta | Moka",
};

// Registro self-serve para el funnel: crea una cuenta con plan='demo'
// (lo asigna el trigger handle_new_user cuando no hay invitación).
export default function RegisterPage() {
  return <RegisterForm />;
}
