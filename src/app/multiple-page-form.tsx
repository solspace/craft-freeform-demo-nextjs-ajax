'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

type FormData = {
  firstName: string;
  email: string;
};

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
  successMessage: string;
  errorMessage: string;
};

type Params = {
  hash: string;
  formData: FormData;
  formButtonName: string;
  reCaptchaValue: string;
  freeformAction: string;
  freeformPayload: string;
  formProperties: FormProperties;
};

const defaultFormData: FormData = {
  firstName: '',
  email: '',
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
  successMessage: '',
  errorMessage: '',
};

const RECAPTCHA_SITE_KEY = '6Lce6nQmAAAAAO5d4LWC6TkECxNRSG7WNiVj17B1';

async function getFormProperties(formId: number) {
  // See https://docs.solspace.com/craft/freeform/v4/developer/graphql/#how-to-render-a-form
  const response = await fetch(`/freeform/form/properties/${formId}`, { headers: { 'Accept': 'application/json' }});

  if (!response.ok) {
    throw new Error('Failed to fetch Craft Freeform Form properties');
  }

  return response.json();
}

async function saveSubmission(params: Params) {
  const { reCaptchaValue, formData, formProperties, hash, formButtonName, freeformPayload, freeformAction } = params;
  const { csrf, honeypot } = formProperties;

  const body = new FormData();

  // Spam and security
  body.append(csrf.name, csrf.token);
  body.append(honeypot.name, honeypot.value);
  body.append('g-recaptcha', reCaptchaValue);

  // Keeps track of the forms state
  body.append('formHash', hash);
  body.append('freeform_payload', freeformPayload);

  // Tell form which direction to go in
  body.append(formButtonName, '1'); // This will be "form_page_submit" or "form_previous_page_button"
  body.append('action', 'freeform/submit');
  body.append('freeform-action', freeformAction); // This will be "submit" or "back"

  // Now populate your actual field values
  body.append('firstName', formData.firstName);
  body.append('email', formData.email);

  // Make sure your Craft server has correct CORS setup
  const response = await fetch('/actions/freeform/submit', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrf.token,
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest',
      'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('Failed to submit Craft Freeform Form');
  }

  return response.json();
}

const Form = () => {
  const spamMessageRef = useRef<HTMLDivElement>(null);
  const errorMessageRef = useRef<HTMLDivElement>(null);
  const successMessageRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const { executeRecaptcha } = useGoogleReCaptcha();

  const [hash, setHash] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reCaptchaValue, setReCaptchaValue] = useState('');
  const [formData, setFormData] = useState(defaultFormData);
  const [freeformPayload, setFreeformPayload] = useState('');
  const [formProperties, setFormProperties] = useState(defaultFormProperties);

  const startProcessing = (freeformAction: string) => {
    if (submitButtonRef.current) {
      submitButtonRef.current.style.cursor = 'not-allowed';
      submitButtonRef.current.innerText = (freeformAction === 'submit') ? 'Loading...' : 'Submit';
    }

    if (backButtonRef.current) {
      backButtonRef.current.innerText = 'Back';
      backButtonRef.current.style.cursor = 'not-allowed';
    }
  };

  const stopProcessing = () => {
    if (submitButtonRef.current) {
      submitButtonRef.current.innerText = 'Submit';
      submitButtonRef.current.style.cursor = 'pointer';
    }

    if (backButtonRef.current) {
      backButtonRef.current.innerText = 'Back';
      backButtonRef.current.style.cursor = 'pointer';
    }
  };

  const showSubmissionSuccess = () => {
    if (successMessageRef.current) {
      successMessageRef.current.style.display = 'block';
      scrollToTop();
    }
  };

  const hideSubmissionSuccess = () => {
    if (successMessageRef.current) {
      successMessageRef.current.style.display = 'none';
    }
  };

  const showSubmissionError = () => {
    if (errorMessageRef.current) {
      errorMessageRef.current.style.display = 'block';
      scrollToTop();
    }
  };

  const showSpamError = () => {
    if (spamMessageRef.current) {
      spamMessageRef.current.style.display = 'block';
      scrollToTop();
    }
  };

  const hideSubmissionError = () => {
    if (errorMessageRef.current) {
      errorMessageRef.current.style.display = 'none';
    }

    const errors = document.querySelectorAll('.error-message');
    if (errors) {
      errors.forEach(error => {
        error.classList.remove('flex');
        error.classList.add('hidden');
      });
    }
  };

  const hideSpamError = () => {
    if (spamMessageRef.current) {
      spamMessageRef.current.style.display = 'none';
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReCaptchaVerify = useCallback(async () => {
    if (!executeRecaptcha) {
      return;
    }

    const token = await executeRecaptcha();
    setReCaptchaValue(token);
  }, [executeRecaptcha]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    /**
     * When we submit the form, we need to find which button was clicked - the submit button or back button?
     * Both submit the form but have different actions. We set the action to submit or back.
     */
    let formButtonName: string = 'form_page_submit';
    let freeformAction: string = 'submit';

    const nativeEvent = event.nativeEvent as SubmitEvent;
    const clickedButton = nativeEvent.submitter as HTMLButtonElement | null;
    if (clickedButton) {
      formButtonName = clickedButton.name;
      freeformAction = (formButtonName === 'form_page_submit') ? 'submit' : 'back';
    }

    hideSpamError();
    hideSubmissionError();
    hideSubmissionSuccess();
    startProcessing(freeformAction);

    handleReCaptchaVerify().then(async () => {
      const response = await saveSubmission({ hash, formData, formButtonName, freeformAction, freeformPayload, reCaptchaValue, formProperties });

      stopProcessing();

      if (response && response.success) {
        /**
         * After each submit button click, we either go back or forward. We check page number so we can toggle field layouts.
         * Setting the new hash and payload values helps keep track of the forms state when we go back or forward.
         * If we're on the last page, show submission success message and reset the form again.
         * Finally, we handle errors.
         */
        setHash(response.hash);
        setFreeformPayload(response.freeform_payload);

        if (freeformAction === 'submit') {
          if (currentPage === 1) {
            setCurrentPage(2);
          } else if (currentPage === 2) {
            setCurrentPage(1);
            showSubmissionSuccess();
            setFormData(defaultFormData);
          }
        } else if (freeformAction === 'back') {
          setCurrentPage(1);
        }
      } else if (response && response.formErrors && response.formErrors.length > 0) {
        if (response.formErrors.includes('Please verify that you are not a robot.')) {
          showSpamError();
        } else if (response.formErrors.includes('Unknown argument')) {
          console.error(response.formErrors);
        }
      } else if (response && response.errors) {
        showSubmissionError();

        for (const [key, value] of Object.entries(response.errors)) {
          if (!/^-?\d+$/.test(key)) {
            const element = document.querySelector(`.${key}-field .error-message`);
            if (element) {
              // @ts-ignore
              element.innerHTML = value[0];
              element.classList.add('flex');
              element.classList.remove('hidden');
            }
          }
        }
      }
    });
  };

  useEffect(() => {
    handleReCaptchaVerify().then();
  }, [handleReCaptchaVerify]);

  /**
   * Note the ignore variable which is initialized to false, and is set to true during cleanup.
   * This ensures your code doesn't suffer from "race conditions": network responses may arrive in a different order than you sent them.
   */
  useEffect(() => {
    let ignore = false;

    // TODO - Set your Freeform Form ID from Craft here.
    const formId = 8;

    getFormProperties(formId).then(formProperties => {
      if (!ignore) {
        setFormProperties(formProperties);

        /**
         * First step is to store the hash and payload in the Apps state.
         * Each time we move back or forward, we get new hash and payloads - this is what allows us to keep track of the forms state.
         */
        setHash(formProperties.hash);
        setFreeformPayload(formProperties.freeform_payload);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <form className="text-center flex flex-col items-left justify-left" onSubmit={handleSubmit}>
      <h3 className="mb-4 text-xl font-normal text-left">Multiple Page Form</h3>
      <div ref={successMessageRef} className="w-full bg-green-100 border border-green-400 text-sm text-left text-green-700 px-4 py-2 rounded-md mb-8" style={{ display: 'none' }}>
        <p>{formProperties.successMessage}</p>
      </div>
      <div ref={errorMessageRef} className="w-full bg-red-100 border border-red-400 text-sm text-left text-red-700 px-4 py-2 rounded-md mb-8" style={{ display: 'none' }}>
        <p>{formProperties.errorMessage}</p>
      </div>
      <div ref={spamMessageRef} className="w-full bg-red-100 border border-red-400 text-sm text-left text-red-700 px-4 py-2 rounded-md mb-8" style={{ display: 'none' }}>
        <p>Please verify that you are not a robot.</p>
      </div>
      <div className="flex flex-col w-full space-y-3">
        {/*
        Ideally, the form properties call would also expose the forms layout like the number of pages and fields etc.
        If we did have that info, we'd loop over pages and display fields layout per page.
        For now, can we manually display fields based on the current page.
        */}
        <div className="form-row" style={{ display: currentPage === 1 ? 'flex' : 'none' }}>
          <div className="field-wrapper firstName-field">
            <label htmlFor="firstName">First Name <span className="ml-1 text-[red]">*</span></label>
            <input className="form-input field-input" name="firstName" type="text" id="firstName" value={formData.firstName} onChange={event => setFormData({ ...formData, firstName: event.target.value })} />
            <span className="field-error error-message hidden"></span>
          </div>
        </div>
        <div className="form-row" style={{ display: currentPage === 2 ? 'flex' : 'none' }}>
          <div className="field-wrapper email-field">
            <label htmlFor="email">Email <span className="ml-1 text-[red]">*</span></label>
            <div className="text-sm text-slate-400">We&apos;ll never share your email with anyone else.</div>
            <input className="form-input field-input" name="email" type="email" id="email" value={formData.email} onChange={event => setFormData({ ...formData, email: event.target.value })} />
            <span className="field-error error-message hidden"></span>
          </div>
        </div>
        <div className="form-row">
          <div className="flex flex-row items-left justify-between w-full">
            {currentPage === 2 ? (
                <button ref={backButtonRef} name="form_previous_page_button" className="btn-neutral" type="submit">Back</button>
            ) : null}
            <button ref={submitButtonRef} name="form_page_submit" className="btn-primary" type="submit">Submit</button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default function MultiplePageForm() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
      <Form />
    </GoogleReCaptchaProvider>
  );
};
