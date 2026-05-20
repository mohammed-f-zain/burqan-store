import Swal from "sweetalert2";

type ToastKind = "success" | "error" | "info" | "warning";

function fireToast(kind: ToastKind, message: string, timerMs = 4000) {
  const rtl = document.documentElement.getAttribute("dir") === "rtl";
  void Swal.fire({
    toast: true,
    icon: kind,
    title: message,
    position: rtl ? "top-start" : "top-end",
    showConfirmButton: false,
    timer: timerMs,
    timerProgressBar: true,
    didOpen: (popup) => {
      popup.addEventListener("mouseenter", Swal.stopTimer);
      popup.addEventListener("mouseleave", Swal.resumeTimer);
    },
    customClass: {
      popup: "swal-burqan swal-toast-burqan",
    },
  });
}

export function toastSuccess(message: string) {
  fireToast("success", message);
}

export function toastError(message: string) {
  fireToast("error", message, 5500);
}

export function toastInfo(message: string) {
  fireToast("info", message);
}

export function toastWarning(message: string) {
  fireToast("warning", message, 5000);
}
