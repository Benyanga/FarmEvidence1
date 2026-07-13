import React from 'react';
import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import Container from 'react-bootstrap/Container';

export default function SignIn() {
  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <ClerkSignIn routing="path" path="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
    </Container>
  );
}
