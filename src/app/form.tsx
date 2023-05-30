'use client';

import React, { useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

type FormProperties = {
  csrf: {
    name: string;
    token: string;
  },
  hash: string;
  honeypot: {
    name: string;
    value: string;
  },
  freeform_payload: string;
};

type Params = {
  reCaptchaValue: string;
  formProperties: FormProperties;
};

const defaultFormProperties: FormProperties = {
  csrf: {
    name: '',
    token: '',
  },
  hash: '',
  honeypot: {
    name: '',
    value: '',
  },
  freeform_payload: '',
};

const RECAPTCHA_SITE_KEY = '1234567890abcdef';

async function getFormProperties(formId: number) {
  // See https://docs.solspace.com/craft/freeform/v4/developer/graphql/#how-to-render-a-form
  const response = await fetch(`/my-module/freeform/form-properties/${formId}`, { headers: { 'Accept': 'application/json' }});

  if (!response.ok) {
    throw new Error('Failed to fetch Freeform form properties');
  }

  return response.json();
}

async function saveKitchenSinkSubmission(params: Params) {
  const { reCaptchaValue, formProperties } = params;
  const { csrf, hash, honeypot, freeform_payload } = formProperties;

  const formData = new FormData();
  formData.append(csrf.name, csrf.token);
  formData.append(honeypot.name, honeypot.value);

  formData.append('formHash', hash);
  formData.append('freeform_payload', freeform_payload);
  formData.append('g-recaptcha-response', reCaptchaValue);

  // Update the form data key/value pairs with your own Freeform Form field names and values
  formData.append('textField', 'Submitted via NextJS + AJAX');

  const response = await fetch('/actions/freeform/submit', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrf.token,
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest',
      'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest',
      'X-Craft-Solspace-Freeform-Mode': 'Headless',
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to submit Freeform form');
  }

  return response.json();
}

export default function Form() {
  const [formProperties, setFormProperties] = useState(defaultFormProperties);
  const [reCaptchaValue, setReCaptchaValue] = useState('');

  const handleChange = (token: string|null): void => {
    setReCaptchaValue(token ?? '');
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    const response = await saveKitchenSinkSubmission({ reCaptchaValue, formProperties });
    console.log(response);
  };

  /**
   * Note the ignore variable which is initialized to false, and is set to true during cleanup.
   * This ensures your code doesn't suffer from "race conditions": network responses may arrive in a different order than you sent them.
   */
  useEffect(() => {
    let ignore = false;

    // Set your Freeform Form ID from Craft.
    const formId = 3;

    getFormProperties(formId).then(formProperties => {
      if (!ignore) {
        setFormProperties(formProperties);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <form
      className="text-center"
      onSubmit={handleSubmit}
    >
      <ReCAPTCHA
        sitekey={RECAPTCHA_SITE_KEY}
        onChange={handleChange}
      />
      <button
        className="btn-primary"
        type="submit"
      >
        Submit
      </button>
    </form>
  );
};
