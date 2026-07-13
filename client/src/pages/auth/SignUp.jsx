import React from 'react';
import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import Container from 'react-bootstrap/Container';

export default function SignUp() {
  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <ClerkSignUp routing="path" path="/sign-up" signInUrl="/sign-in" afterSignUpUrl="/select-role" />
    </Container>
  );
}
