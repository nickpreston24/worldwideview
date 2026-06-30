import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
