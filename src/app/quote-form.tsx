'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

// ENTER YOUR FORM ID HERE
const FORM_ID = undefined;

// ENTER YOUR RECAPTCHA KEY HERE
const RECAPTCHA_SITE_KEY = undefined;

type ErrorData = {
    [key: string]: string[];
};

type FormData = {
    workPhone: string;
    subject: string;
    message: string;
    lastName: string;
    howMuchDoYouEnjoyEatingPie: string;
    howDidYouHearAboutThisJobPosting: string[];
    homePhone: string;
    firstName: string;
    email: string;
    department: string;
    companyName: string;
    cellPhone: string;
    appointmentDate: string;
    acceptTerms: string;
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
    reCaptcha: {
        enabled: boolean;
        handle: string;
        name: string;
    };
    loadingText: string;
    successMessage: string;
    errorMessage: string;
};

type Params = {
    formData: FormData;
    reCaptchaValue: string | null;
    formProperties: FormProperties;
};

const defaultFormData: FormData = {
    workPhone: '',
    subject: '',
    message: '',
    lastName: '',
    howMuchDoYouEnjoyEatingPie: '',
    howDidYouHearAboutThisJobPosting: [],
    homePhone: '',
    firstName: '',
    email: '',
    department: '',
    companyName: '',
    cellPhone: '',
    appointmentDate: '',
    acceptTerms: '',
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
    reCaptcha: {
        enabled: false,
        handle: '',
        name: '',
    },
    loadingText: '',
    successMessage: '',
    errorMessage: '',
};

async function getFormProperties(): Promise<FormProperties> {
    // See https://docs.solspace.com/craft/freeform/v4/developer/graphql/#how-to-render-a-form
    const response = await fetch(`/craft/freeform/form/properties/${FORM_ID}`, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Craft Freeform Form properties');
    }

    return response.json();
}

async function saveQuoteSubmission(params: Params) {
    const { reCaptchaValue, formData, formProperties } = params;
    const { csrf, hash, honeypot, freeform_payload, reCaptcha } = formProperties;

    const body = new FormData();
    body.append(csrf.name, csrf.token);
    body.append(honeypot.name, honeypot.value);

    body.append('formHash', hash);
    body.append('freeform_payload', freeform_payload);

    if (reCaptcha?.enabled && reCaptcha.name && reCaptchaValue) {
        body.append(reCaptcha.name, reCaptchaValue);
    }

    body.append('firstName', formData.firstName);
    body.append('lastName', formData.lastName);
    body.append('companyName', formData.companyName);
    body.append('email', formData.email);
    body.append('cellPhone', formData.cellPhone);
    body.append('homePhone', formData.homePhone);
    body.append('workPhone', formData.workPhone);
    body.append('subject', formData.subject);
    body.append('appointmentDate', formData.appointmentDate);
    body.append('department', formData.department);
    body.append('howMuchDoYouEnjoyEatingPie', formData.howMuchDoYouEnjoyEatingPie);
    body.append('message', formData.message);

    for (let i = 0; i < formData.howDidYouHearAboutThisJobPosting.length; i++) {
        body.append('howDidYouHearAboutThisJobPosting[]', formData.howDidYouHearAboutThisJobPosting[i]);
    }

    body.append('acceptTerms', formData.acceptTerms);

    const response = await fetch('/craft/actions/freeform/submit', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrf.token,
            'Cache-Control': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Craft-Solspace-Freeform-Mode': 'Headless',
        },
        body,
    });

    if (!response.ok) {
        throw new Error('Failed to submit Craft Freeform Form');
    }

    return response.json();
}

const Form = () => {
    const { executeRecaptcha } = useGoogleReCaptcha();

    const [formData, setFormData] = useState<FormData>(defaultFormData);
    const [formProperties, setFormProperties] = useState<FormProperties>(defaultFormProperties);
    const [showSpam, setShowSpam] = useState(false);
    const [showError, setShowError] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const isFormReady = Boolean(formProperties.csrf?.name && formProperties.csrf?.token && formProperties.hash && formProperties.honeypot?.name && formProperties.freeform_payload);

    const startProcessing = () => {
        setIsProcessing(true);
    };

    const stopProcessing = () => {
        setIsProcessing(false);
    };

    const showSubmissionSuccess = () => {
        setShowSuccess(true);
        scrollToTop();
    };

    const hideSubmissionSuccess = () => {
        setShowSuccess(false);
    };

    const showSubmissionError = () => {
        setShowError(true);
        scrollToTop();
    };

    const hideSubmissionError = () => {
        setShowError(false);
        setFieldErrors({});
    };

    const showSpamError = () => {
        setShowSpam(true);
        scrollToTop();
    };

    const hideSpamError = () => {
        setShowSpam(false);
    };

    const showFieldError = (errors: ErrorData) => {
        const nextErrors: Record<string, string> = {};

        for (const [key, value] of Object.entries(errors)) {
            if (!/^-?\d+$/.test(key) && Array.isArray(value) && value.length) {
                nextErrors[key] = value[0];
            }
        }

        setFieldErrors(nextErrors);
    };

    const clearFieldError = (fieldName: string) => {
        setFieldErrors((currentErrors) => {
            const nextErrors = { ...currentErrors };

            delete nextErrors[fieldName];

            return nextErrors;
        });
    };

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    const handleReCaptchaVerify = useCallback(async () => {
        if (!executeRecaptcha) {
            return null;
        }

        return await executeRecaptcha('submit');
    }, [executeRecaptcha]);

    const handleSubmit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();

        if (!isFormReady) {
            return;
        }

        hideSpamError();
        hideSubmissionError();
        hideSubmissionSuccess();
        startProcessing();

        try {
            let reCaptchaValue: string | null = null;

            if (formProperties.reCaptcha?.enabled) {
                reCaptchaValue = await handleReCaptchaVerify();

                if (!reCaptchaValue) {
                    stopProcessing();
                    showSubmissionError();

                    return;
                }
            }

            const response = await saveQuoteSubmission({
                reCaptchaValue,
                formData,
                formProperties,
            });

            stopProcessing();

            if (response && response.success) {
                setFormData(defaultFormData);
                setFieldErrors({});
                showSubmissionSuccess();
            } else if (response) {
                showSubmissionError();

                let hasSpamError = false;

                if (response.errors) {
                    showFieldError(response.errors as ErrorData);
                }

                if (response.formErrors && response.formErrors.length > 0) {
                    const formErrors = response.formErrors as string[];

                    if (formErrors.includes('Please verify that you are not a robot.')) {
                        hasSpamError = true;
                    }

                    if (formErrors.includes('Unknown argument')) {
                        console.error(formErrors);
                    }

                    if (!hasSpamError && !formErrors.includes('Unknown argument')) {
                        console.error(formErrors);
                    }
                }

                if (hasSpamError) {
                    showSpamError();
                }
            } else {
                showSubmissionError();
            }
        } catch (error) {
            stopProcessing();
            showSubmissionError();

            console.error(error);
        }
    };

    const handleHowDidYouHearAboutThisJobPosting = (event: React.ChangeEvent<HTMLInputElement>): void => {
        let howDidYouHearAboutThisJobPosting = [...formData.howDidYouHearAboutThisJobPosting];

        if (event.target.checked) {
            if (!howDidYouHearAboutThisJobPosting.includes(event.target.value)) {
                howDidYouHearAboutThisJobPosting.push(event.target.value);
            }
        } else {
            howDidYouHearAboutThisJobPosting = howDidYouHearAboutThisJobPosting.filter((value) => value !== event.target.value);
        }

        setFormData({
            ...formData,
            howDidYouHearAboutThisJobPosting,
        });
    };

    /**
     * Note the ignore variable which is initialized to false, and is set to true during cleanup.
     * This ensures your code doesn't suffer from "race conditions": network responses may arrive in a different order than you sent them.
     */
    useEffect(() => {
        let ignore = false;

        getFormProperties()
            .then((formProperties) => {
                if (!ignore) {
                    setFormProperties(formProperties);
                }
            })
            .catch((error) => {
                if (!ignore) {
                    console.error(error);

                    setShowError(true);
                }
            });

        return () => {
            ignore = true;
        };
    }, []);

    return (
        <form className="text-center flex flex-col items-left justify-left" onSubmit={handleSubmit}>
            <h3 className="mb-4 text-xl font-normal text-left">Quote Form</h3>
            {showSuccess && (
                <div className="w-full bg-green-100 border border-green-400 text-sm text-left text-green-700 px-4 py-2 rounded-md mb-8">
                    <p>{formProperties.successMessage}</p>
                </div>
            )}
            {showError && (
                <div className="w-full bg-red-100 border border-red-400 text-sm text-left text-red-700 px-4 py-2 rounded-md mb-8">
                    <p>{formProperties.errorMessage || 'There was a problem submitting the form.'}</p>
                </div>
            )}
            {showSpam && (
                <div className="w-full bg-red-100 border border-red-400 text-sm text-left text-red-700 px-4 py-2 rounded-md mb-8">
                    <p>Please verify that you are not a robot.</p>
                </div>
            )}
            <div className="flex flex-col w-full space-y-3">
                <div className="form-row">
                    <div className="field-wrapper firstName-field">
                        <label htmlFor="firstName">First Name <span className="ml-1 text-[red]">*</span></label>
                        <input className="form-input field-input" name="firstName" type="text" id="firstName" value={formData.firstName} onChange={(event) => { setFormData({ ...formData, firstName: event.target.value }); clearFieldError('firstName'); }} />
                        {fieldErrors.firstName && (
                            <span className="field-error error-message">{fieldErrors.firstName}</span>
                        )}
                    </div>
                    <div className="field-wrapper lastName-field">
                        <label htmlFor="lastName">Last Name <span className="ml-1 text-[red]">*</span></label>
                        <input className="form-input field-input" name="lastName" type="text" id="lastName" value={formData.lastName} onChange={(event) => { setFormData({ ...formData, lastName: event.target.value }); clearFieldError('lastName'); }} />
                        {fieldErrors.lastName && (
                            <span className="field-error error-message">{fieldErrors.lastName}</span>
                        )}
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper">
                        <label htmlFor="companyName">Organization Name</label>
                        <input className="form-input field-input" name="companyName" type="text" id="companyName" value={formData.companyName} onChange={(event) => setFormData({ ...formData, companyName: event.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper email-field">
                        <label htmlFor="email">Email <span className="ml-1 text-[red]">*</span></label>
                        <div className="text-sm text-slate-400">We&apos;ll never share your email with anyone else.</div>
                        <input className="form-input field-input" name="email" type="email" id="email" value={formData.email} onChange={(event) => { setFormData({ ...formData, email: event.target.value }); clearFieldError('email'); }} />
                        {fieldErrors.email && (
                              <span className="field-error error-message">{fieldErrors.email}</span>
                        )}
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper cellPhone-field">
                        <label htmlFor="cellPhone">Cell Phone <span className="ml-1 text-[red]">*</span></label>
                        <input className="form-input field-input" name="cellPhone" type="tel" id="cellPhone" value={formData.cellPhone} onChange={(event) => { setFormData({ ...formData, cellPhone: event.target.value }); clearFieldError('cellPhone'); }} />
                        {fieldErrors.cellPhone && (
                            <span className="field-error error-message">{fieldErrors.cellPhone}</span>
                        )}
                    </div>
                    <div className="field-wrapper">
                        <label htmlFor="homePhone">Home Phone</label>
                        <input className="form-input field-input" name="homePhone" type="tel" id="homePhone" value={formData.homePhone} onChange={(event) => setFormData({ ...formData, homePhone: event.target.value })} />
                    </div>
                    <div className="field-wrapper">
                        <label htmlFor="workPhone">Work Phone</label>
                        <input className="form-input field-input" name="workPhone" type="tel" id="workPhone" value={formData.workPhone} onChange={(event) => setFormData({ ...formData, workPhone: event.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper subject-field">
                        <label htmlFor="subject">Subject <span className="ml-1 text-[red]">*</span></label>
                        <select className="form-select field-input" name="subject" id="subject" value={formData.subject} onChange={(event) => { setFormData({ ...formData, subject: event.target.value }); clearFieldError('subject'); }}>
                            <option value="">I need some help with...</option>
                            <option value="myHomework">My homework</option>
                            <option value="practicingMyHammerDance">Practicing my hammer dance</option>
                            <option value="findingMyBellyButton">Finding my belly button</option>
                        </select>
                        {fieldErrors.subject && (
                            <span className="field-error error-message">{fieldErrors.subject}</span>
                        )}
                    </div>
                    <div className="field-wrapper">
                        <label htmlFor="appointmentDate">Appointment Date</label>
                        <input className="form-input field-input" name="appointmentDate" type="text" id="appointmentDate" placeholder="YYYY/MM/DD" autoComplete="off" value={formData.appointmentDate} onChange={(event) => setFormData({ ...formData, appointmentDate: event.target.value })} />
                    </div>
                    <div className="field-wrapper department-field">
                        <label htmlFor="department">Department <span className="ml-1 text-[red]">*</span></label>
                        <select className="form-select field-input" name="department" id="department" value={formData.department} onChange={(event) => { setFormData({ ...formData, department: event.target.value }); clearFieldError('department'); }}>
                            <option value="">Please choose...</option>
                            <option value="sales@example.com">Sales</option>
                            <option value="service@example.com">Service</option>
                            <option value="support@example.com">Support</option>
                        </select>
                        {fieldErrors.department && (
                            <span className="field-error error-message">{fieldErrors.department}</span>
                        )}
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper">
                        <label htmlFor="howMuchDoYouEnjoyEatingPie-1" className="flex flex-row">How much do you enjoy eating pie?</label>
                        <div className="flex flex-row space-x-4">
                            {[1, 2, 3, 4, 5].map((value) => (
                                <label key={value} htmlFor={`howMuchDoYouEnjoyEatingPie-${value}`} className="flex flex-row items-center justify-center">
                                    <input className="field-input-radio" name="howMuchDoYouEnjoyEatingPie" type="radio" id={`howMuchDoYouEnjoyEatingPie-${value}`} value={String(value)} onChange={(event) => setFormData({ ...formData, howMuchDoYouEnjoyEatingPie: event.target.value })} /> {value}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper message-field">
                        <label htmlFor="message">Message <span className="ml-1 text-[red]">*</span></label>
                        <textarea className="form-textarea field-input" name="message" id="message" rows={5} value={formData.message} onChange={(event) => { setFormData({ ...formData, message: event.target.value }); clearFieldError('message'); }} />
                        {fieldErrors.message && (
                            <span className="field-error error-message">{fieldErrors.message}</span>
                        )}
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper">
                        <label htmlFor="howDidYouHearAboutThisJobPosting-Newspaper">How did you hear about us?</label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-Newspaper" value="Newspaper" onChange={handleHowDidYouHearAboutThisJobPosting} /> Newspaper
                        </label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-Radio" value="Radio" onChange={handleHowDidYouHearAboutThisJobPosting} /> Radio
                        </label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-CarrierPigeon" value="Carrier Pigeon" onChange={handleHowDidYouHearAboutThisJobPosting} /> Carrier Pigeon
                        </label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-Other" value="Other" onChange={handleHowDidYouHearAboutThisJobPosting} /> Other
                        </label>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper acceptTerms-field">
                        <label htmlFor="acceptTerms" className="flex flex-row items-center justify-start">
                            <input className="field-input-checkbox" name="acceptTerms" type="checkbox" id="acceptTerms" value="yes" onChange={(event) => { setFormData({ ...formData, acceptTerms: event.target.checked ? event.target.value : '' }); clearFieldError('acceptTerms'); }} />
                            I agree to the <a href="https://solspace.com" className="mx-1 underline">terms &amp; conditions</a> required by this site. <span className="ml-1 text-[red]">*</span>
                        </label>
                        {fieldErrors.acceptTerms && (
                            <span className="field-error error-message">{fieldErrors.acceptTerms}</span>
                        )}
                    </div>
                </div>
                <div className="form-row">
                    <div className="flex flex-row items-left justify-left space-y-2 w-full">
                        <button className="btn-primary" type="submit" disabled={isProcessing || !isFormReady} style={{ cursor: isProcessing || !isFormReady ? 'not-allowed' : 'pointer' }}>{isProcessing ? formProperties.loadingText || 'Submitting...' : !isFormReady ? 'Loading...' : 'Submit'}</button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default function QuoteForm() {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
          <Form />
      </GoogleReCaptchaProvider>
    );
};
