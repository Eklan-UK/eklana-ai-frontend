"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { X, Check, Crown } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PaymentModalPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 relative">
          {/* Close Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">
            Elevate your English learning experience with
          </h2>

          {/* Comparison Table */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="text-center font-semibold text-gray-900 py-2">
                FREE
              </div>
              <div className="text-center font-semibold text-gray-900 py-2 bg-green-50 rounded-lg relative">
                Premium
                <Crown className="w-4 h-4 text-yellow-500 absolute top-1 right-2" />
              </div>
            </div>

            <div className="space-y-3">
              {[
                { feature: "Learning content", free: true, premium: true },
                { feature: "Offline learning", free: false, premium: true },
                { feature: "Premium content", free: false, premium: true },
                {
                  feature: "Unlimited Chatbot Access",
                  free: false,
                  premium: true,
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-2 gap-2 items-center py-2"
                >
                  <div className="text-sm text-gray-700">{item.feature}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-center">
                      {item.free ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <div className="w-5 h-5"></div>
                      )}
                    </div>
                    <div className="flex justify-center bg-green-50 rounded">
                      {item.premium ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <div className="w-5 h-5"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button — plans & gated trial live on subscriptions page */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push("/account/settings/subscriptions")}
            className="mb-3"
          >
            View plans
          </Button>

          {/* Skip Link */}
          <button
            onClick={() => router.back()}
            className="w-full text-center text-orange-600 text-sm font-medium"
          >
            Skip
          </button>
        </Card>
      </div>
    </div>
  );
}
