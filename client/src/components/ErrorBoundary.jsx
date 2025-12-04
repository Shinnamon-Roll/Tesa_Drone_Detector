import React from "react";

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Error boundary caught:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        padding: "40px",
                        textAlign: "center",
                        maxWidth: "600px",
                        margin: "100px auto",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                >
                    <h1 style={{ color: "#dc3545", marginBottom: "20px" }}>
                        ⚠️ Something went wrong
                    </h1>
                    <p style={{ color: "#6c757d", marginBottom: "10px" }}>
                        {this.state.error?.message || "An unexpected error occurred"}
                    </p>
                    {this.state.errorInfo && (
                        <details style={{ marginTop: "20px", textAlign: "left" }}>
                            <summary style={{ cursor: "pointer", color: "#007bff" }}>
                                Error details
                            </summary>
                            <pre
                                style={{
                                    marginTop: "10px",
                                    padding: "10px",
                                    backgroundColor: "#fff",
                                    borderRadius: "4px",
                                    overflow: "auto",
                                    fontSize: "12px",
                                }}
                            >
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: "20px",
                            padding: "10px 20px",
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "16px",
                        }}
                    >
                        🔄 Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
